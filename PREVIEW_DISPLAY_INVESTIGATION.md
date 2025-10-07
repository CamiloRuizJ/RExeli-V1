# Preview Display Investigation

**Issue:** Documents show raw JSON code instead of formatted display after processing completes.

---

## ✅ Good News: Formatted Displays Already Exist!

The `ResultsDisplay.tsx` component (`src/components/results/ResultsDisplay.tsx`) has beautiful, professionally formatted displays for ALL 8 document types:

### Document Type Displays

1. **Rent Roll** → Formatted table with:
   - Summary metrics (Total Rent, Occupancy, Avg PSF)
   - Tenant details table
   - Lease expiration dates
   - Status badges

2. **Operating Budget** → Cards showing:
   - Income statement breakdown
   - Expense categories
   - NOI calculation
   - Cash flow analysis

3. **Broker Sales Comparables** → Professional layout:
   - Average Price/SF, Cap Rate metrics
   - Comparable sales table
   - Property details per comp

4. **Broker Lease Comparables** → Structured view:
   - Average rents (base & effective)
   - Lease terms table
   - Tenant industry info

5. **Broker Listing** → Detailed cards:
   - Listing information
   - Property details
   - Pricing information
   - Broker duties & terms

6. **Offering Memo** → Investment view:
   - Key metrics (Price, Cap Rate, NOI)
   - Property overview
   - Financial summary
   - Investment highlights

7. **Lease Agreement** → Legal contract layout:
   - Lease parties & premises
   - Rent schedule
   - Operating expenses
   - Maintenance obligations

8. **Financial Statements** → Accounting format:
   - Operating income breakdown
   - Expense categories
   - Balance sheet
   - Cash flow analysis

---

## 🔍 Diagnostic Steps

### Step 1: Upload a Test Document

Please upload a **broker_sales_comparables** document (since you have 10 verified of that type) and check what happens:

1. Go to https://rexeli-v1-akchax60s-camiloruizjs-projects.vercel.app/tool
2. Upload a broker sales comparables document
3. Let it process completely
4. **Screenshot the result section**
5. **Open browser console (F12) and screenshot any errors**

### Step 2: Check Console Logs

Look for these specific log messages:
```
OpenAI extraction response: {...}
Extraction successful: {...}
```

The extraction should return data in this structure:
```json
{
  "documentType": "broker_sales_comparables",
  "metadata": {
    "propertyName": "...",
    "propertyAddress": "...",
    "extractedDate": "2025-01-07"
  },
  "data": {
    "summary": {...},
    "comparables": [...]
  }
}
```

### Step 3: Verify Data Structure

The issue is likely one of these:

❌ **Problem A: Wrong documentType value**
```javascript
// If documentType is undefined or doesn't match expected values
extractedData.documentType === undefined // Falls through to 'unknown'
extractedData.documentType === "sales_comps" // Doesn't match case
```

❌ **Problem B: Data in wrong location**
```javascript
// If data is at extractedData.data.data instead of extractedData.data
extractedData = {
  documentType: "broker_sales_comparables",
  data: {
    data: {...} // ← Wrong nesting
  }
}
```

❌ **Problem C: Rendering error**
```javascript
// If renderBrokerSalesComparablesData() throws error
// Falls back to renderGenericData() which shows raw JSON
```

---

## 🛠️ Likely Fixes

### Fix 1: Data Structure Mapping
If data is nested incorrectly:

```typescript
// In tool/page.tsx
const extractedData = result; // Current

// Should be:
const extractedData = {
  documentType: result.documentType,
  metadata: result.metadata,
  data: result.data // Make sure this is the actual data, not nested
};
```

### Fix 2: Document Type Validation
Add debug logging:

```typescript
// In ResultsDisplay.tsx renderDataByType()
console.log('Rendering document type:', extractedData.documentType);
console.log('Data structure:', extractedData.data);
console.log('Type check:', typeof extractedData.data);
```

### Fix 3: Error Boundary
Wrap renderDataByType() to catch specific errors:

```typescript
try {
  return renderBrokerSalesComparablesData(extractedData.data as BrokerSalesComparablesData);
} catch (error) {
  console.error('Rendering error for broker sales comparables:', error);
  console.error('Data received:', extractedData.data);
  // Then show generic/raw view
}
```

---

## 📸 What I Need From You

Please provide screenshots of:

1. **The raw JSON display** (what you're seeing now)
2. **Browser console** (F12 → Console tab) with any errors
3. **Network tab** showing the /api/extract response
4. **The document you're testing with** (if possible)

This will help me pinpoint exactly where the data structure breaks.

---

## 🎯 Expected Resolution

Once we identify the issue, the fix will likely be:

### Scenario A: Type Mismatch
- Update documentType mapping in extraction
- Ensure case-sensitive matching

### Scenario B: Data Nesting
- Flatten data structure in API response
- Or adjust how ResultsDisplay accesses data

### Scenario C: Rendering Error
- Fix TypeScript type assertions
- Add better error handling
- Ensure all required fields exist

---

## 🔧 Quick Test

Try this in browser console when viewing results:

```javascript
// Check what extractedData looks like
console.log('Document Type:', window.extractedData?.documentType);
console.log('Has data property:', 'data' in (window.extractedData || {}));
console.log('Data keys:', Object.keys(window.extractedData?.data || {}));
```

If `extractedData` isn't in window scope, check React DevTools component props.

---

## ✅ Next Steps

1. **You:** Upload test document + share screenshots
2. **Me:** Analyze data structure and identify mismatch
3. **Me:** Create fix for data mapping/rendering
4. **You:** Test fix with real document
5. **Done:** Beautiful formatted displays appear! 🎉

The good news is the formatted components already exist and work perfectly. We just need to route the data correctly to them.
