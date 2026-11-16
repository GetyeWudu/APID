-- Align Bank of Abyssinia Fiscal Year quarters to standard Ethiopian Banking calendar (July 1 to June 30)
UPDATE core.fiscal_quarters 
SET start_date = DATE '2026-07-01' 
WHERE fiscal_year = '2026/27' AND quarter = 1;

UPDATE core.fiscal_quarters 
SET end_date = DATE '2027-06-30' 
WHERE fiscal_year = '2026/27' AND quarter = 4;

