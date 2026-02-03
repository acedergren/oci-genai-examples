// kyc-platform/src/segmentation/engine.ts

import type { Customer, CustomerSegment } from '../types.js';
import type { Repository } from '../repository.js';
import { clusterCustomers, embeddingToBuffer } from '../embeddings/index.js';

/**
 * Configuration for segmentation
 */
export interface SegmentationConfig {
  /**
   * Number of segments to create
   * Default: 5
   */
  numSegments?: number;

  /**
   * Minimum customers required for segmentation
   * Default: 20
   */
  minCustomers?: number;

  /**
   * Maximum k-means iterations
   * Default: 100
   */
  maxIterations?: number;

  /**
   * Whether to generate AI descriptions
   * Default: true
   */
  generateDescriptions?: boolean;
}

/**
 * Result of segmentation operation
 */
export interface SegmentationResult {
  segments: Array<{
    segment: CustomerSegment;
    members: Customer[];
    avgSimilarity: number;
  }>;
  totalCustomers: number;
  customersSegmented: number;
  executionTimeMs: number;
}

/**
 * Segment characteristics extracted from customer data
 */
export interface SegmentCharacteristics {
  avgIncome?: number;
  incomeRange?: string;
  avgNetWorth?: number;
  commonOccupations: Array<{ occupation: string; count: number }>;
  commonLocations: Array<{ location: string; count: number }>;
  riskDistribution: Record<string, number>;
  kycStatusDistribution: Record<string, number>;
  ageRange?: string;
  size: number;
}

/**
 * Segmentation Engine
 * Performs customer segmentation using embeddings and clustering
 */
export class SegmentationEngine {
  constructor(private repository: Repository) {}

  /**
   * Run segmentation on all customers with embeddings
   */
  async segment(config: SegmentationConfig = {}): Promise<SegmentationResult> {
    const startTime = Date.now();

    const {
      numSegments = 5,
      minCustomers = 20,
      maxIterations = 100,
      generateDescriptions = true,
    } = config;

    // Get all customers with embeddings
    const customers = this.repository.customers.list();
    const customersWithEmbeddings = customers.filter((c) => c.profile_embedding);

    if (customersWithEmbeddings.length < minCustomers) {
      throw new Error(
        `Not enough customers with embeddings. Need at least ${minCustomers}, have ${customersWithEmbeddings.length}`
      );
    }

    // Perform clustering
    const clusters = clusterCustomers(customersWithEmbeddings, numSegments, maxIterations);

    // Create segments in database
    const segments: SegmentationResult['segments'] = [];

    for (const cluster of clusters) {
      // Extract characteristics
      const characteristics = this.extractCharacteristics(cluster.members);

      // Generate segment name
      const name = this.generateSegmentName(cluster.clusterId, characteristics);

      // Create initial description (will be enhanced by AI if enabled)
      const description = this.generateBasicDescription(characteristics);

      // Store segment
      const segment = this.repository.segments.create({
        name,
        description,
        generation_method: 'clustering',
        cluster_id: cluster.clusterId,
        characteristics: JSON.stringify(characteristics),
        typical_behavior: undefined,
        member_count: cluster.members.length,
        avg_customer_value: characteristics.avgIncome,
        risk_profile: this.determineRiskProfile(characteristics),
        centroid_embedding: embeddingToBuffer(cluster.centroid),
        is_active: true,
      });

      // Add members to segment
      for (const member of cluster.members) {
        this.repository.segments.addMember(member.id, segment.id, cluster.avgSimilarity);
      }

      segments.push({
        segment,
        members: cluster.members,
        avgSimilarity: cluster.avgSimilarity,
      });

      // Log audit entry
      this.repository.auditLogs.log({
        event_type: 'segment_created',
        event_category: 'system',
        severity: 'info',
        actor_type: 'system',
        entity_type: 'segment',
        entity_id: segment.id,
        description: `Created customer segment "${name}" with ${cluster.members.length} members`,
        metadata: JSON.stringify({
          cluster_id: cluster.clusterId,
          avg_similarity: cluster.avgSimilarity,
          characteristics,
        }),
      });
    }

    const executionTimeMs = Date.now() - startTime;

    return {
      segments,
      totalCustomers: customers.length,
      customersSegmented: customersWithEmbeddings.length,
      executionTimeMs,
    };
  }

  /**
   * Extract characteristics from a group of customers
   */
  private extractCharacteristics(customers: Customer[]): SegmentCharacteristics {
    const characteristics: SegmentCharacteristics = {
      size: customers.length,
      commonOccupations: [],
      commonLocations: [],
      riskDistribution: {},
      kycStatusDistribution: {},
    };

    // Income statistics
    const incomes = customers.filter((c) => c.annual_income).map((c) => c.annual_income!);
    if (incomes.length > 0) {
      characteristics.avgIncome = incomes.reduce((sum, i) => sum + i, 0) / incomes.length;
      characteristics.incomeRange = this.categorizeIncomeRange(
        Math.min(...incomes),
        Math.max(...incomes)
      );
    }

    // Net worth statistics
    const netWorths = customers.filter((c) => c.net_worth).map((c) => c.net_worth!);
    if (netWorths.length > 0) {
      characteristics.avgNetWorth = netWorths.reduce((sum, nw) => sum + nw, 0) / netWorths.length;
    }

    // Occupation frequency
    const occupationCounts = new Map<string, number>();
    for (const customer of customers) {
      if (customer.occupation) {
        occupationCounts.set(customer.occupation, (occupationCounts.get(customer.occupation) || 0) + 1);
      }
    }
    characteristics.commonOccupations = Array.from(occupationCounts.entries())
      .map(([occupation, count]) => ({ occupation, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Location frequency
    const locationCounts = new Map<string, number>();
    for (const customer of customers) {
      if (customer.city && customer.country) {
        const location = `${customer.city}, ${customer.country}`;
        locationCounts.set(location, (locationCounts.get(location) || 0) + 1);
      }
    }
    characteristics.commonLocations = Array.from(locationCounts.entries())
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Risk distribution
    for (const customer of customers) {
      if (customer.risk_level) {
        characteristics.riskDistribution[customer.risk_level] =
          (characteristics.riskDistribution[customer.risk_level] || 0) + 1;
      }
    }

    // KYC status distribution
    for (const customer of customers) {
      characteristics.kycStatusDistribution[customer.kyc_status] =
        (characteristics.kycStatusDistribution[customer.kyc_status] || 0) + 1;
    }

    return characteristics;
  }

  /**
   * Generate a descriptive name for a segment
   */
  private generateSegmentName(clusterId: number, characteristics: SegmentCharacteristics): string {
    const parts: string[] = [];

    // Income-based naming
    if (characteristics.avgIncome) {
      if (characteristics.avgIncome < 40000) {
        parts.push('Budget-Conscious');
      } else if (characteristics.avgIncome < 80000) {
        parts.push('Middle-Income');
      } else if (characteristics.avgIncome < 150000) {
        parts.push('Upper-Middle');
      } else {
        parts.push('High-Income');
      }
    }

    // Occupation-based naming
    if (characteristics.commonOccupations.length > 0) {
      const topOccupation = characteristics.commonOccupations[0].occupation;
      if (topOccupation.toLowerCase().includes('student')) {
        parts.push('Students');
      } else if (topOccupation.toLowerCase().includes('engineer') || topOccupation.toLowerCase().includes('tech')) {
        parts.push('Tech Professionals');
      } else if (topOccupation.toLowerCase().includes('manager') || topOccupation.toLowerCase().includes('executive')) {
        parts.push('Business Leaders');
      }
    }

    // Fallback to generic naming
    if (parts.length === 0) {
      parts.push(`Segment ${clusterId + 1}`);
    }

    return parts.join(' ');
  }

  /**
   * Generate a basic description from characteristics
   */
  private generateBasicDescription(characteristics: SegmentCharacteristics): string {
    const parts: string[] = [];

    parts.push(`This segment contains ${characteristics.size} customers.`);

    if (characteristics.avgIncome) {
      parts.push(`Average annual income: $${Math.round(characteristics.avgIncome).toLocaleString()}.`);
    }

    if (characteristics.avgNetWorth) {
      parts.push(`Average net worth: $${Math.round(characteristics.avgNetWorth).toLocaleString()}.`);
    }

    if (characteristics.commonOccupations.length > 0) {
      const topOccupations = characteristics.commonOccupations
        .slice(0, 3)
        .map((o) => o.occupation)
        .join(', ');
      parts.push(`Common occupations: ${topOccupations}.`);
    }

    if (characteristics.commonLocations.length > 0) {
      const topLocations = characteristics.commonLocations
        .slice(0, 3)
        .map((l) => l.location)
        .join(', ');
      parts.push(`Primary locations: ${topLocations}.`);
    }

    return parts.join(' ');
  }

  /**
   * Determine overall risk profile for segment
   */
  private determineRiskProfile(characteristics: SegmentCharacteristics): string {
    const { riskDistribution } = characteristics;
    const total = Object.values(riskDistribution).reduce((sum, count) => sum + count, 0);

    if (total === 0) return 'unknown';

    const highRiskCount = (riskDistribution.high || 0) + (riskDistribution.critical || 0);
    const highRiskPercent = highRiskCount / total;

    if (highRiskPercent > 0.5) return 'high';
    if (highRiskPercent > 0.2) return 'medium';
    return 'low';
  }

  /**
   * Categorize income range
   */
  private categorizeIncomeRange(min: number, max: number): string {
    const format = (n: number) => `$${Math.round(n / 1000)}k`;
    return `${format(min)} - ${format(max)}`;
  }

  /**
   * Re-segment customers (useful when new customers are added)
   */
  async resegment(config: SegmentationConfig = {}): Promise<SegmentationResult> {
    // Deactivate existing segments
    const existingSegments = this.repository.segments.listActive();
    for (const segment of existingSegments) {
      // Note: We'd need an update method in the repository for this
      // For now, segments remain active and we create new ones
    }

    // Run new segmentation
    return this.segment(config);
  }

  /**
   * Get segment recommendations for a customer
   */
  getCustomerRecommendations(customerId: string, limit: number = 3): Array<{
    segmentId: string;
    segmentName: string;
    reason: string;
  }> {
    const segments = this.repository.segments.getCustomerSegments(customerId);

    return segments.slice(0, limit).map((segment) => ({
      segmentId: segment.id,
      segmentName: segment.name,
      reason: `Based on ${Math.round(segment.confidence * 100)}% similarity to segment profile`,
    }));
  }
}

/**
 * Create a segmentation engine instance
 */
export function createSegmentationEngine(repository: Repository): SegmentationEngine {
  return new SegmentationEngine(repository);
}
