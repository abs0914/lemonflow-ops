// Order text parser for Quick Order Entry feature
// Parses unstructured order messages from messaging apps into structured line items

export interface ParsedOrderItem {
  itemCode: string;
  description: string;
  quantity: number;
  unit: string;
  notes: string;
  isValid?: boolean;
}

export interface ParsedOrder {
  branch?: string;
  requester?: string;
  items: ParsedOrderItem[];
  unparsedLines: string[];
}

// Known units with variations
const UNIT_PATTERNS: Record<string, RegExp> = {
  packs: /packs?/i,
  bottles: /bottles?/i,
  pcs: /pcs|pieces?/i,
  gallons: /gallons?/i,
  unit: /units?/i,
  box: /box(es)?/i,
  case: /cases?/i,
  roll: /rolls?/i,
  dozen: /dozens?|doz/i,
};

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
    // Clean up trailing punctuation or common phrases
    return requesterMatch[1]
      .replace(/thank\s*you\.?$/i, '')
      .trim();
  }
  return undefined;
}

// Check if line is a section header
function isSectionHeader(line: string): boolean {
  const trimmed = line.trim();
  
  // Skip empty lines
  if (!trimmed) return true;
  
  // Check against known section patterns
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

// Extract unit from text
function extractUnit(text: string): { unit: string; remaining: string } {
  const lowerText = text.toLowerCase();
  
  for (const [normalizedUnit, pattern] of Object.entries(UNIT_PATTERNS)) {
    const match = text.match(pattern);
    if (match) {
      return {
        unit: normalizedUnit,
        remaining: text.replace(pattern, '').trim(),
      };
    }
  }
  
  return { unit: 'unit', remaining: text };
}

// Parse a single line to extract item details
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
  
  // Main pattern: Item code followed by optional description and quantity/unit
  // Handles: TLC00001 (LEMON)-150pcs, TLC00003 CUCUMBER- 3 packs, etc.
  const itemPattern = /^([A-Z]{2,4}\d{4,6})\s*[-(\s]*([^-\d\n]*?)\s*[-)\s]*[-–]?\s*(\d+)?\s*(packs?|bottles?|pcs|pieces?|gallons?|units?|box(?:es)?|cases?|rolls?|dozens?|doz)?/i;
  
  const match = trimmed.match(itemPattern);
  
  if (match) {
    const itemCode = match[1].toUpperCase();
    let description = (match[2] || '').trim();
    let quantity = match[3] ? parseInt(match[3], 10) : 1;
    let unit = match[4] || 'unit';
    
    // Normalize unit
    for (const [normalizedUnit, pattern] of Object.entries(UNIT_PATTERNS)) {
      if (pattern.test(unit)) {
        unit = normalizedUnit;
        break;
      }
    }
    
    // Clean up description - remove trailing dashes, parentheses
    description = description
      .replace(/^[(\s-]+/, '')
      .replace(/[)\s-]+$/, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Extract any additional notes from the end of the line
    let notes = '';
    
    // Look for parenthetical notes after the quantity/unit
    const remainingAfterMatch = trimmed.substring(match[0].length).trim();
    if (remainingAfterMatch) {
      const parentheticalMatch = remainingAfterMatch.match(/\(([^)]+)\)/);
      if (parentheticalMatch) {
        notes = parentheticalMatch[1].trim();
      } else {
        notes = remainingAfterMatch;
      }
    }
    
    // Handle case where description might contain notes like "Medium" or "Black"
    const descParts = description.match(/^(.+?)\s+(Medium|Large|Small|Black|White|Red|Blue|Green)/i);
    if (descParts) {
      description = descParts[1].trim();
      notes = notes ? `${descParts[2]} ${notes}` : descParts[2];
    }
    
    return {
      itemCode,
      description,
      quantity: quantity || 1,
      unit,
      notes: notes.trim(),
    };
  }
  
  return null;
}

// Main parsing function
export function parseOrderText(text: string): ParsedOrder {
  const lines = text.split('\n');
  const items: ParsedOrderItem[] = [];
  const unparsedLines: string[] = [];
  
  // Extract metadata
  const branch = extractBranch(text);
  const requester = extractRequester(text);
  
  let currentSection = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines
    if (!trimmed) continue;
    
    // Skip branch/requester lines
    if (/^Branch:/i.test(trimmed) || /^Requested\s*By:/i.test(trimmed)) continue;
    
    // Track current section for notes
    if (isSectionHeader(trimmed)) {
      // Extract section name for potential notes
      if (/LACKING\s*ITEMS?/i.test(trimmed)) {
        currentSection = 'LACKING ITEMS';
      } else {
        currentSection = trimmed.replace(/["']/g, '').trim();
      }
      continue;
    }
    
    // Skip closing phrases
    if (isClosingPhrase(trimmed)) continue;
    
    // Try to parse as item line
    const item = parseItemLine(trimmed);
    
    if (item) {
      // Add section context as notes for lacking items
      if (currentSection === 'LACKING ITEMS' && !item.notes) {
        item.notes = 'LACKING ITEMS';
      }
      items.push(item);
    } else {
      // Track unparsed lines (but not empty or known skip patterns)
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
