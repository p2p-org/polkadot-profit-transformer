-- Min amount to get into active set
-- Min amount to get into active set
-- { "description": "", "type": "COUNTER", "options": { "tooltipFormat": "0,0.000", "rowNumber": 1, "stringDecChar": ".", "stringDecimal": 0, "counterColName": "min", "counterLabel": "", "stringThouSep": ",", "targetRowNumber": 1 }, "name": "Min amount to get into active set", "query_id": 20 }
-- {"options": { "parameterMappings": {}, "isHidden": false, "position": { "autoHeight": false, "sizeX": 2, "sizeY": 5, "maxSizeY": 1000, "maxSizeX": 6, "minSizeY": 1, "minSizeX": 1, "col": 4, "row": 15 } }, "text":"","width":1,"dashboard_id":1,"visualization_id":54}
with eras_validators as 
(SELECT era,
    --   account_id,
    --   nominators_count,
    --   CASE WHEN nominators_count > 126 THEN 'Oversubscribed' END as oversubscribed,
    --   reward_points,
    --   total,
    --   own,
       SUM(total/10^10)::float as total_stake,
       max(total)/10^10::float as max,
       avg(total)/10^10::float as avg,
       min(total)/10^10::float as min
FROM mbelt.validators
GROUP BY era)

SELECT era, total_stake, max, avg, min, min / avg * 100 as ratio_min_to_avg
FROM eras_validators 
WHERE era != 0
ORDER BY era desc




