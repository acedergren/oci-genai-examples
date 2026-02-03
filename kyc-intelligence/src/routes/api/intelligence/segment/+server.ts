// src/routes/api/intelligence/segment/+server.ts
import { json, error } from '@sveltejs/kit';
import { getRepository } from '$lib/server/db.js';
import { createSegmentationEngine } from '@acedergren/kyc-platform/segmentation';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { numSegments = 5 } = await request.json();

    const repository = getRepository();
    const engine = createSegmentationEngine(repository);

    // Run segmentation
    const result = await engine.segment({
      numSegments,
      minCustomers: 10, // Lower threshold for demo
      generateDescriptions: true,
    });

    return json({
      success: true,
      result: {
        totalCustomers: result.totalCustomers,
        customersSegmented: result.customersSegmented,
        segmentsCreated: result.segments.length,
        executionTimeMs: result.executionTimeMs,
      },
    });
  } catch (err) {
    console.error('Segmentation error:', err);
    return error(500, {
      message: err instanceof Error ? err.message : 'Segmentation failed',
    });
  }
};
