-- Run before migration 037. Both result sets must return zero rows.

SELECT lower(trim(email)) AS normalized_email, COUNT(*) AS account_count
FROM customers
WHERE email IS NOT NULL AND trim(email) <> ''
GROUP BY normalized_email
HAVING COUNT(*) > 1;

SELECT normalized_phone, COUNT(*) AS account_count
FROM (
  SELECT replace(replace(replace(replace(replace(replace(replace(replace(trim(phone), ' ', ''), char(9), ''), char(10), ''), char(13), ''), '-', ''), '(', ''), ')', ''), '.', '') AS normalized_phone
  FROM customers WHERE phone IS NOT NULL AND trim(phone) <> ''
  UNION ALL
  SELECT replace(replace(replace(replace(replace(replace(replace(replace(trim(phone), ' ', ''), char(9), ''), char(10), ''), char(13), ''), '-', ''), '(', ''), ')', ''), '.', '') AS normalized_phone
  FROM engineers WHERE phone IS NOT NULL AND trim(phone) <> ''
)
GROUP BY normalized_phone
HAVING COUNT(*) > 1;
