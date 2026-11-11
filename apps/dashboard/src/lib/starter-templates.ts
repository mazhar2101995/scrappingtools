export interface ContentTemplate {
  id: string;
  name: string;
  description: string;
  type: 'starter' | 'custom';
  appliedToFields: string[]; // e.g. ['description', 'features']
  layoutMode: 'simple' | 'advanced';
  sections?: Array<{
    id: string;
    title: string;
    fieldKey: string;
    conditionField?: string;
    formatBoldKeyword?: string;
  }>;
  advancedHtml?: string;
  scopedCss?: string;
  status: 'active' | 'inactive';
  updatedAt: string;
}

export const STARTER_CONTENT_TEMPLATES: ContentTemplate[] = [
  {
    id: 'tpl_classic_desc',
    name: '1. Classic Product Description',
    description: 'Clean paragraph layout with highlight bullets and structured feature summary.',
    type: 'starter',
    appliedToFields: ['description'],
    layoutMode: 'simple',
    sections: [
      { id: 'sec_1', title: 'Product Overview', fieldKey: 'description' },
      { id: 'sec_2', title: 'Key Features & Benefits', fieldKey: 'features', conditionField: 'features' },
      { id: 'sec_3', title: 'Specifications Summary', fieldKey: 'specifications', conditionField: 'specifications' },
    ],
    status: 'active',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl_technical_layout',
    name: '2. Technical Product Layout',
    description: 'Engineering & specification-first layout designed for industrial and B2B products.',
    type: 'starter',
    appliedToFields: ['specifications'],
    layoutMode: 'simple',
    sections: [
      { id: 'sec_1', title: 'Technical Specifications Table', fieldKey: 'specifications' },
      { id: 'sec_2', title: 'Model & Part Compatibility', fieldKey: 'compatibleModels', conditionField: 'compatibleModels' },
      { id: 'sec_3', title: 'Dimensions & Tolerances', fieldKey: 'dimensions', conditionField: 'dimensions' },
    ],
    status: 'active',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl_feature_focused',
    name: '3. Feature-Focused Layout',
    description: 'Emphasizes value propositions, bullet points, and key differentiators.',
    type: 'starter',
    appliedToFields: ['features'],
    layoutMode: 'simple',
    sections: [
      { id: 'sec_1', title: 'Core Advantages', fieldKey: 'features' },
      { id: 'sec_2', title: 'Product Description', fieldKey: 'description', conditionField: 'description' },
      { id: 'sec_3', title: 'Warranty & Support Details', fieldKey: 'warranty', conditionField: 'warranty' },
    ],
    status: 'active',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl_minimal_clean',
    name: '4. Minimal Clean Layout',
    description: 'Distraction-free high readability typography without excessive borders or badges.',
    type: 'starter',
    appliedToFields: ['description'],
    layoutMode: 'simple',
    sections: [
      { id: 'sec_1', title: '', fieldKey: 'description' },
      { id: 'sec_2', title: 'Details', fieldKey: 'specifications', conditionField: 'specifications' },
    ],
    status: 'active',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl_premium_brand',
    name: '5. Premium Brand Layout',
    description: 'High-end showcase format with bold titles, luxury styling and structured cards.',
    type: 'starter',
    appliedToFields: ['description', 'features'],
    layoutMode: 'simple',
    sections: [
      { id: 'sec_1', title: 'Craftsmanship & Engineering', fieldKey: 'description' },
      { id: 'sec_2', title: 'Executive Highlights', fieldKey: 'features', conditionField: 'features' },
      { id: 'sec_3', title: 'Technical Verification', fieldKey: 'specifications', conditionField: 'specifications' },
      { id: 'sec_4', title: 'Fitment & Verification', fieldKey: 'compatibleModels', conditionField: 'compatibleModels' },
    ],
    status: 'active',
    updatedAt: new Date().toISOString(),
  },
];
