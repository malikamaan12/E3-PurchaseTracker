# Enhanced PDF Implementation Guide

## Font Color Implementation

The font color customization has been successfully implemented throughout the PDF generation system. The key updates include:

1. Added support for document-wide font color setting at the beginning of the `generatePurchaseRequestPDF` function:

```typescript
// Apply document-wide font color if specified
if (options?.fontColor) {
  try {
    const fontColor = hexToRgb(options.fontColor);
    doc.setTextColor(fontColor[0], fontColor[1], fontColor[2]);
  } catch (error) {
    console.error('Error parsing font color:', error);
  }
}
```

2. Applied font color customization in each table rendering function (basic info, vendor info, items, approvals, etc.):

```typescript
// Apply custom font color if provided in the config
let textColor = [0, 0, 0]; // Default black
if (cfg && cfg.fontColor) {
  try {
    textColor = hexToRgb(cfg.fontColor);
  } catch (error) {
    console.error('Error parsing font color:', error);
  }
}

(autoTable as any)(doc, {
  // ... other settings ...
  styles: { 
    fontSize: 9, 
    cellPadding: 3, 
    overflow: 'linebreak',
    textColor: textColor // Apply custom font color
  },
  // ... other settings ...
});
```

3. Added support for font color in signature lines:

```typescript
// Apply custom font color to signature text if specified
if (cfg && cfg.fontColor) {
  try {
    const fontColor = hexToRgb(cfg.fontColor);
    doc.setTextColor(fontColor[0], fontColor[1], fontColor[2]);
  } catch (error) {
    console.error('Error parsing font color:', error);
  }
}
```

4. Enhanced the `hexToRgb` function with better error handling:

```typescript
function hexToRgb(hex: string): [number, number, number] {
  const defaultColor: [number, number, number] = [111, 42, 230]; // E3 purple #6F2AE6
  try {
    // Remove the # if present
    const cleanHex = hex.replace(/^#/, '');
    
    // Validate hex format (3 or 6 characters)
    if (!/^([0-9A-F]{3}){1,2}$/i.test(cleanHex)) {
      return defaultColor;
    }
    
    // Handle both 3-char and 6-char hex
    const r = parseInt(cleanHex.length === 3 ? cleanHex[0] + cleanHex[0] : cleanHex.substr(0, 2), 16);
    const g = parseInt(cleanHex.length === 3 ? cleanHex[1] + cleanHex[1] : cleanHex.substr(2, 2), 16);
    const b = parseInt(cleanHex.length === 3 ? cleanHex[2] + cleanHex[2] : cleanHex.substr(4, 2), 16);
    
    // Handle NaN values
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return defaultColor;
    }
    
    return [r, g, b];
  } catch (error) {
    console.error(`Error parsing hex color ${hex}:`, error);
    return defaultColor;
  }
}
```

## Good Practices for PDF Generation

1. **Document-Wide Settings**: Always apply global settings at the beginning of the PDF generation process.

2. **Table-Specific Settings**: Each table function should have its own settings that override document-wide settings if needed.

3. **Error Handling**: Always include proper error handling when parsing colors or working with external data.

4. **Consistent Function Signatures**: All component functions (addHeader, addBasicInfoTable, etc.) should accept the same parameters to maintain consistency.

5. **Reset Text Color**: Always reset text color after sections that modify it: `doc.setTextColor(0, 0, 0);`

## Known Issues and Solutions

1. **Duplicate Variable Declarations**: The refactored code had some duplicate textColor declarations that needed to be fixed. Each function should only declare textColor once.

2. **Missing Parameters**: The signature lines function was updated to accept the config parameter to maintain consistent function signatures.

3. **Page Overflow**: Enhanced page handling using the `ensureContentFits` function that properly manages content placement and pagination.

## Testing Approach

To test the font color implementation, create a PDF with different font colors and verify that:

1. The text color changes correctly in all sections
2. The table text color is applied consistently 
3. The signature lines use the correct font color
4. The color changes do not affect other styling like bold/italic
5. The color changes persist across page breaks

## Next Steps

- Update the PDFPreview component to demonstrate realtime font color changes
- Apply the same font color implementation to the admin panel's PDF generation
- Fix any TypeScript errors in PDFPreview.tsx related to implicit 'any' types