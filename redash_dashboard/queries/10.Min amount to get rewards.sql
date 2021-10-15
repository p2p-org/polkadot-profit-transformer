-- Active accounts
-- Active accounts
-- { "description": "", "type": "COUNTER", "options": { "tooltipFormat": "0,0.000", "formatTargetValue": false, "rowNumber": 1, "stringDecChar": ".", "stringDecimal": 0, "counterColName": "min_stake", "counterLabel": "", "stringThouSep": ",", "targetRowNumber": 1 }, "name": "Min amount to get rewards", "query_id": 20 }
-- { "options": { "parameterMappings": {}, "isHidden": false, "position": { "autoHeight": false, "sizeX": 2, "sizeY": 5, "maxSizeY": 1000, "maxSizeX": 6, "minSizeY": 1, "minSizeX": 1, "col": 4, "row": 60 } }, "text":"","width":1,"dashboard_id":1,"visualization_id":54}
select COUNT(DISTINCT account_id) 
FROM account_identity
where killed_at is not null