// Order text parser for Quick Order Entry feature
// Parses unstructured order messages from messaging apps into structured line items
// SIMPLIFIED: Only extracts item code and quantity - UOM comes from inventory

export interface ParsedOrderItem {
  itemCode: string;
  quantity: number;
  notes: string;
  isValid?: boolean;
}

export interface ParsedOrder {
  branch?: string;
  requester?: string;
  items: ParsedOrderItem[];
  unparsedLines: string[];
}

// Section headers to skip (all caps, quotes, or known header keywords)
const SECTION_HEADER_PATTERNS = [
  /^["']?[A-Z\s'"]+["']?$/,
  /^BEVERAGE\s*SKU/i,
  /^FOOD\s*SERVICES?/i,
  /^FLAVORED/i,
  /^NON\s*CONSUMABLES?\s*SKU/i,
  /^OFFICE\s*SUPPLIES?\s*SKU/i,
  /^LACKING\s*ITEMS?:?/i,
];

// Common closing phrases to skip
const CLOSING_PATTERNS = [
  /^thank\s*you\.?$/i,
  /^thanks\.?$/i,
  /^salamat\.?$/i,
];

// Extract branch from text
function extractBranch(text: string): string | undefined {
  const branchMatch = text.match(/Branch:\s*(.+)/i);
  return branchMatch ? branchMatch[1].trim() : undefined;
}

// Extract requester from text
function extractRequester(text: string): string | undefined {
  const requesterMatch = text.match(/Requested\s*By:\s*(.+)/i);
  if (requesterMatch) {
    return requesterMatch[1]
      .replace(/thank\s*you\.?$/i, '')
      .trim();
  }
  return undefined;
}

// Check if line is a section header
function isSectionHeader(line: string): boolean {
  const trimmed = line.trim();
  
  if (!trimmed) return true;
  
  for (const pattern of SECTION_HEADER_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  
  // All caps text without item code pattern
  if (/^[A-Z\s'"]+$/.test(trimmed) && trimmed.length > 3) {
    return true;
  }
  
  return false;
}

// Check if line is a closing phrase
function isClosingPhrase(line: string): boolean {
  const trimmed = line.trim();
  return CLOSING_PATTERNS.some(pattern => pattern.test(trimmed));
}

// Parse a single line to extract item code and quantity only
function parseItemLine(line: string): ParsedOrderItem | null {
  const trimmed = line.trim();
  
  // Skip empty, headers, and closing phrases
  if (!trimmed || isSectionHeader(trimmed) || isClosingPhrase(trimmed)) {
    return null;
  }
  
  // Skip branch and requester lines
  if (/^Branch:/i.test(trimmed) || /^Requested\s*By:/i.test(trimmed)) {
    return null;
  }
  
  // Simplified pattern: Item code (2-4 letters + 4-6 digits) followed by quantity
  // Handles: TLC00001 - 150pcs, TLC00003- 3 packs, TLC00001 (LEMON)-150pcs, etc.
  const itemPattern = /^([A-Z]{2,4}\d{4,6})\s*[-(\s]*[^-\d]*[-)\s]*[-–]?\s*(\d+)/i;
  
  const match = trimmed.match(itemPattern);
  
  if (match) {
    const itemCode = match[1].toUpperCase();
    const quantity = parseInt(match[2], 10) || 1;
    
    return {
      itemCode,
      quantity,
      notes: '',
    };
  }
  
  return null;
}

// Main parsing function
export function parseOrderText(text: string): ParsedOrder {
  const lines = text.split('\n');
  const items: ParsedOrderItem[] = [];
  const unparsedLines: string[] = [];
  
  const branch = extractBranch(text);
  const requester = extractRequester(text);
  
  let currentSection = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (!trimmed) continue;
    
    if (/^Branch:/i.test(trimmed) || /^Requested\s*By:/i.test(trimmed)) continue;
    
    // Track current section for notes
    if (isSectionHeader(trimmed)) {
      if (/LACKING\s*ITEMS?/i.test(trimmed)) {
        currentSection = 'LACKING ITEMS';
      } else {
        currentSection = trimmed.replace(/["']/g, '').trim();
      }
      continue;
    }
    
    if (isClosingPhrase(trimmed)) continue;
    
    const item = parseItemLine(trimmed);
    
    if (item) {
      // Add section context as notes for lacking items
      if (currentSection === 'LACKING ITEMS') {
        item.notes = 'LACKING ITEMS';
      }
      items.push(item);
    } else {
      if (trimmed && !isClosingPhrase(trimmed)) {
        unparsedLines.push(trimmed);
      }
    }
  }
  
  return {
    branch,
    requester,
    items,
    unparsedLines,
  };
}

// Validate parsed items against a list of valid item codes
export function validateParsedItems(
  items: ParsedOrderItem[],
  validCodes: Set<string>
): ParsedOrderItem[] {
  return items.map(item => ({
    ...item,
    isValid: validCodes.has(item.itemCode),
  }));
}
