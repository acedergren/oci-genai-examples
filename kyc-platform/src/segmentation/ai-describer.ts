// kyc-platform/src/segmentation/ai-describer.ts

import type { CustomerSegment } from '../types.js';
import type { SegmentCharacteristics } from './engine.js';

/**
 * Prompt template for generating segment descriptions
 */
function buildSegmentDescriptionPrompt(
  segmentName: string,
  characteristics: SegmentCharacteristics,
  sampleCustomers: Array<{ occupation?: string; income?: number; location?: string }>
): string {
  return `You are a financial services analyst specializing in customer segmentation. Generate a detailed, actionable description of this customer segment.

Segment Name: ${segmentName}

Segment Size: ${characteristics.size} customers

Demographics:
- Average Income: ${characteristics.avgIncome ? `$${Math.round(characteristics.avgIncome).toLocaleString()}` : 'N/A'}
- Average Net Worth: ${characteristics.avgNetWorth ? `$${Math.round(characteristics.avgNetWorth).toLocaleString()}` : 'N/A'}
- Income Range: ${characteristics.incomeRange || 'N/A'}

Top Occupations:
${characteristics.commonOccupations.map((o) => `- ${o.occupation} (${o.count} customers)`).join('\n')}

Top Locations:
${characteristics.commonLocations.map((l) => `- ${l.location} (${l.count} customers)`).join('\n')}

Risk Distribution:
${Object.entries(characteristics.riskDistribution)
  .map(([level, count]) => `- ${level}: ${count} customers`)
  .join('\n')}

KYC Status:
${Object.entries(characteristics.kycStatusDistribution)
  .map(([status, count]) => `- ${status}: ${count} customers`)
  .join('\n')}

Sample Customer Profiles:
${sampleCustomers.slice(0, 3).map((c, i) => `${i + 1}. ${c.occupation || 'Unknown occupation'}, ${c.income ? `$${Math.round(c.income).toLocaleString()}` : 'income unknown'}, ${c.location || 'location unknown'}`).join('\n')}

Please provide:
1. **Profile Overview** (2-3 sentences): Who are these customers?
2. **Key Characteristics** (3-5 bullet points): What defines this segment?
3. **Financial Behavior** (2-3 sentences): How do they engage with financial products?
4. **Business Opportunities** (3-4 bullet points): What products/services would appeal to them?
5. **Risk Considerations** (2-3 sentences): What should we be aware of?

Format your response in clear sections with the headers above.`;
}

/**
 * Prompt template for generating personalized recommendations
 */
export function buildRecommendationPrompt(
  customerProfile: {
    name: string;
    occupation?: string;
    income?: number;
    netWorth?: number;
    riskLevel?: string;
  },
  segmentDescription: string,
  segmentCharacteristics: SegmentCharacteristics
): string {
  return `You are a financial advisor. Based on the customer's profile and their segment, generate 3-5 personalized product recommendations.

Customer Profile:
- Name: ${customerProfile.name}
- Occupation: ${customerProfile.occupation || 'Unknown'}
- Annual Income: ${customerProfile.income ? `$${Math.round(customerProfile.income).toLocaleString()}` : 'Not disclosed'}
- Net Worth: ${customerProfile.netWorth ? `$${Math.round(customerProfile.netWorth).toLocaleString()}` : 'Not disclosed'}
- Risk Level: ${customerProfile.riskLevel || 'Not assessed'}

Customer Segment: ${segmentDescription}

Segment Typical Behavior:
- Average Income: $${Math.round(segmentCharacteristics.avgIncome || 0).toLocaleString()}
- Common Occupations: ${segmentCharacteristics.commonOccupations.slice(0, 3).map((o) => o.occupation).join(', ')}

Generate 3-5 personalized recommendations for financial products or services. For each recommendation, include:
1. **Product/Service Name**
2. **Why it's suitable** (1-2 sentences)
3. **Expected benefit** (specific, quantifiable if possible)

Focus on actionable, relevant recommendations that align with both the individual profile and segment characteristics.`;
}

/**
 * AI-powered segment description enhancement
 * This is a documentation interface - actual implementation requires AI SDK integration
 */
export interface AISegmentDescriber {
  /**
   * Enhance a segment description using AI
   */
  enhanceDescription(
    segment: CustomerSegment,
    characteristics: SegmentCharacteristics,
    sampleCustomers: Array<{ occupation?: string; income?: number; location?: string }>
  ): Promise<{
    description: string;
    typicalBehavior: string;
    businessOpportunities: string[];
    riskConsiderations: string;
  }>;

  /**
   * Generate personalized recommendations for a customer
   */
  generateRecommendations(
    customerProfile: {
      name: string;
      occupation?: string;
      income?: number;
      netWorth?: number;
      riskLevel?: string;
    },
    segmentDescription: string,
    segmentCharacteristics: SegmentCharacteristics
  ): Promise<Array<{
    product: string;
    rationale: string;
    benefit: string;
  }>>;
}

/**
 * Integration guide for implementing AI descriptions
 */
export const AI_INTEGRATION_GUIDE = `
To implement AI-powered segment descriptions in your SvelteKit application:

1. Install dependencies:
   npm install ai @acedergren/oci-genai-provider

2. Create a server-side API endpoint (e.g., /api/intelligence/describe):

   import { generateText } from 'ai';
   import { createOCI } from '@acedergren/oci-genai-provider';
   import { buildSegmentDescriptionPrompt } from '@acedergren/kyc-platform/segmentation';

   export const POST = async ({ request }) => {
     const { segmentId } = await request.json();

     // Get segment and characteristics from database
     const repository = getRepository();
     const segment = repository.segments.findById(segmentId);
     const characteristics = JSON.parse(segment.characteristics);

     // Get sample customers
     const members = // ... get segment members
     const sampleCustomers = members.slice(0, 3).map(m => ({
       occupation: m.occupation,
       income: m.annual_income,
       location: m.city ? \`\${m.city}, \${m.country}\` : undefined
     }));

     // Generate description with Cohere Command R+
     const oci = createOCI({ region: process.env.OCI_REGION });
     const model = oci.languageModel('cohere.command-r-plus');

     const { text } = await generateText({
       model,
       prompt: buildSegmentDescriptionPrompt(
         segment.name,
         characteristics,
         sampleCustomers
       ),
       temperature: 0.7,
       maxTokens: 1000,
     });

     // Parse and structure the response
     // Extract sections: Profile Overview, Key Characteristics, etc.
     const structured = parseAIResponse(text);

     // Update segment in database
     repository.db.prepare(\`
       UPDATE customer_segments
       SET description = ?, typical_behavior = ?, updated_at = ?
       WHERE id = ?
     \`).run(
       structured.profileOverview,
       structured.financialBehavior,
       Date.now(),
       segmentId
     );

     return json({ success: true, description: structured });
   };

3. Use in your segmentation workflow:

   async function enhanceSegmentsWithAI(segments: CustomerSegment[]) {
     for (const segment of segments) {
       const response = await fetch('/api/intelligence/describe', {
         method: 'POST',
         body: JSON.stringify({ segmentId: segment.id }),
       });

       const { description } = await response.json();
       console.log(\`Enhanced segment: \${segment.name}\`, description);
     }
   }

4. For personalized recommendations:

   import { buildRecommendationPrompt } from '@acedergren/kyc-platform/segmentation';

   async function generateCustomerRecommendations(customerId: string) {
     const customer = repository.customers.findById(customerId);
     const segments = repository.segments.getCustomerSegments(customerId);
     const topSegment = segments[0];

     const prompt = buildRecommendationPrompt(
       {
         name: \`\${customer.first_name} \${customer.last_name}\`,
         occupation: customer.occupation,
         income: customer.annual_income,
         netWorth: customer.net_worth,
         riskLevel: customer.risk_level,
       },
       topSegment.description,
       JSON.parse(topSegment.characteristics)
     );

     const { text } = await generateText({
       model: oci.languageModel('cohere.command-r-plus'),
       prompt,
       temperature: 0.8,
       maxTokens: 800,
     });

     return parseRecommendations(text);
   }

Best Practices:
- Cache AI-generated descriptions (they don't change often)
- Use lower temperature (0.6-0.7) for factual descriptions
- Use higher temperature (0.8-0.9) for creative recommendations
- Validate and sanitize AI output before storing
- Rate limit AI API calls to manage costs
- Consider batch processing for multiple segments
`;

/**
 * Example prompt builders (exported for use in SvelteKit apps)
 */
export { buildSegmentDescriptionPrompt };
