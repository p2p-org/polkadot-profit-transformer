-- Transfers
-- Transfers
-- { "description": "", "type": "COUNTER", "options": { "tooltipFormat": "0,0.000", "rowNumber": 1, "stringDecChar": ".", "stringDecimal": 0, "counterColName": "count", "counterLabel": "", "stringThouSep": ",", "targetRowNumber": 1 }, "name": "Transfers", "query_id": 20 }
-- {"options": { "parameterMappings": {}, "isHidden": false, "position": { "autoHeight": false, "sizeX": 2, "sizeY": 5, "maxSizeY": 1000, "maxSizeX": 6, "minSizeY": 1, "minSizeX": 1, "col": 4, "row": 0 } }, "text":"","width":1,"dashboard_id":1,"visualization_id":54}
select count(id)
from dot_polka.extrinsics
where is_signed = 'true' and parent_id is null