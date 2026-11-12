export interface ContentTemplate {
  id: string;
  name: string;
  description: string;
  type: 'starter' | 'custom';
  appliedToFields: string[]; // e.g. ['description', 'overview', 'specifications', 'part_list', 'finishes']
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
    id: 'tpl_description',
    name: '1. Description (Editorial Paragraph with Highlights)',
    description: 'Clean paragraph typography with bold key phrases (e.g. L shaped desk with hutch, 10-year warranty) for maximum readability.',
    type: 'starter',
    appliedToFields: ['description'],
    layoutMode: 'simple',
    sections: [
      { id: 'sec_desc', title: 'Product Description', fieldKey: 'description' },
    ],
    status: 'active',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl_overview',
    name: '2. Overview (Structured Bulleted Details)',
    description: 'Formatted hierarchical bullet list with "Details" heading and nested circular sub-bullets for storage, locks, certifications.',
    type: 'starter',
    appliedToFields: ['overview'],
    layoutMode: 'simple',
    sections: [
      { id: 'sec_ov', title: 'Details', fieldKey: 'overview' },
    ],
    status: 'active',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl_specifications',
    name: '3. Specifications (Categorized Key-Value Specs)',
    description: 'Grouped technical specifications categorized by Model, Options, and Specifics with clean 2-column alignment.',
    type: 'starter',
    appliedToFields: ['specifications', 'attributes'],
    layoutMode: 'simple',
    sections: [
      { id: 'sec_specs', title: 'Product Specs', fieldKey: 'attributes' },
    ],
    status: 'active',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl_part_list',
    name: '4. Part List (B2B Commercial Pricing Grid Table)',
    description: 'Tabular bill-of-materials with QTY, Part #, Description, List Price, Our Price, and Line Total column headers.',
    type: 'starter',
    appliedToFields: ['part_list'],
    layoutMode: 'simple',
    sections: [
      { id: 'sec_parts', title: 'Parts List', fieldKey: 'part_list' },
    ],
    status: 'active',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl_finishing',
    name: '5. Finishing (Available Finishes Swatches & Catalog)',
    description: 'Visual finish swatch grid featuring material tiles, textures (Ash Gray, Walnut, Mahogany), and color variant chips.',
    type: 'starter',
    appliedToFields: ['finishes', 'finish'],
    layoutMode: 'simple',
    sections: [
      { id: 'sec_finish', title: 'Available Finishes', fieldKey: 'finishes' },
    ],
    status: 'active',
    updatedAt: new Date().toISOString(),
  },
];


