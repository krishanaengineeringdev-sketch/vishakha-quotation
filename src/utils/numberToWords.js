/**
 * Converts a number to Indian numbering system words (Lakhs, Crores)
 * e.g. 125000 -> "Rupees One Lakh Twenty-Five Thousand Only"
 */

const ones = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen'
];

const tens = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety'
];

function convertBelowThousand(n) {
  let str = '';
  if (n >= 100) {
    str += ones[Math.floor(n / 100)] + ' Hundred ';
    n %= 100;
  }
  if (n >= 20) {
    str += tens[Math.floor(n / 10)];
    if (n % 10 > 0) {
      str += '-' + ones[n % 10];
    }
    str += ' ';
  } else if (n > 0) {
    str += ones[n] + ' ';
  }
  return str.trim();
}

export function numberToWordsIndian(amount) {
  const num = Math.round(Number(amount) * 100) / 100;
  if (isNaN(num) || num <= 0) {
    return 'Rupees Zero Only';
  }

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  // Indian groups: Crores (>= 10,000,000), Lakhs (>= 100,000), Thousands (>= 1,000), Hundreds/Units
  let remaining = integerPart;
  let result = '';

  const crores = Math.floor(remaining / 10000000);
  remaining %= 10000000;

  const lakhs = Math.floor(remaining / 100000);
  remaining %= 100000;

  const thousands = Math.floor(remaining / 1000);
  remaining %= 1000;

  const hundreds = remaining;

  if (crores > 0) {
    result += convertBelowThousand(crores) + ' Crore ';
  }
  if (lakhs > 0) {
    result += convertBelowThousand(lakhs) + ' Lakh ';
  }
  if (thousands > 0) {
    result += convertBelowThousand(thousands) + ' Thousand ';
  }
  if (hundreds > 0) {
    result += convertBelowThousand(hundreds) + ' ';
  }

  result = result.trim();
  if (!result) {
    result = 'Zero';
  }

  let words = `Rupees ${result}`;
  if (decimalPart > 0) {
    words += ` and ${convertBelowThousand(decimalPart)} Paise`;
  }
  words += ' Only';

  return words;
}

export function formatIndianCurrency(amount, prefix = 'Rs. ') {
  const num = parseFloat(amount) || 0;
  const formatted = num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return prefix ? `${prefix}${formatted}` : formatted;
}

export default numberToWordsIndian;
