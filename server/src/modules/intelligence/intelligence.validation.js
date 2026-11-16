import { z } from 'zod';
import { categories, categoryDepartments, departments, severities } from './intelligence.taxonomy.js';

export const assessmentSchema = z.object({
  category: z.enum(categories),
  department: z.enum(departments),
  severity: z.enum(severities),
  severity_reason: z.string().trim().min(8).max(1000),
  risk_factors: z.array(z.string().trim().min(1).max(240)).max(8),
  confidence: z.number().min(0).max(1),
  human_review_required: z.boolean(),
  human_review_reason: z.string().trim().max(1000)
}).strict().superRefine((assessment, context) => {
  if (categoryDepartments[assessment.category] !== assessment.department) {
    context.addIssue({ code: 'custom', path: ['department'], message: 'Department does not match category' });
  }
  if (assessment.human_review_required && assessment.human_review_reason.length < 8) {
    context.addIssue({ code: 'custom', path: ['human_review_reason'], message: 'Explain why human review is required' });
  }
  if (assessment.severity === 'CRITICAL' && !assessment.human_review_required) {
    context.addIssue({ code: 'custom', path: ['human_review_required'], message: 'Critical hazards require human verification' });
  }
  if (assessment.severity === 'CRITICAL' && assessment.severity_reason.length < 30) {
    context.addIssue({ code: 'custom', path: ['severity_reason'], message: 'Critical severity requires a specific factual explanation' });
  }
});

export const geminiResponseSchema = {
  type: 'OBJECT',
  properties: {
    category: { type: 'STRING', enum: categories },
    department: { type: 'STRING', enum: departments },
    severity: { type: 'STRING', enum: severities },
    severity_reason: { type: 'STRING' },
    risk_factors: { type: 'ARRAY', items: { type: 'STRING' } },
    confidence: { type: 'NUMBER', minimum: 0, maximum: 1 },
    human_review_required: { type: 'BOOLEAN' },
    human_review_reason: { type: 'STRING' }
  },
  required: [
    'category', 'department', 'severity', 'severity_reason', 'risk_factors',
    'confidence', 'human_review_required', 'human_review_reason'
  ],
  propertyOrdering: [
    'category', 'department', 'severity', 'severity_reason', 'risk_factors',
    'confidence', 'human_review_required', 'human_review_reason'
  ]
};
