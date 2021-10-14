-- Finalised block
-- Finalised block
-- {"description": "", "type": "COUNTER", "options": { "tooltipFormat": "0,0.000", "rowNumber": 1, "stringDecChar": ".", "stringDecimal": 0, "counterColName": "id", "counterLabel": "", "stringThouSep": ",", "targetRowNumber": 1 }, "name": "Finalised block", "query_id": 20 }
-- {"options": { "parameterMappings": {}, "isHidden": false, "position": { "autoHeight": false, "sizeX": 2, "sizeY": 5, "maxSizeY": 1000, "maxSizeX": 6, "minSizeY": 1, "minSizeX": 1, "col": 0, "row": 0 } }, "text":"","width":1,"dashboard_id":1,"visualization_id":54}
select block_time, b.era, b.session_id, b.id, b.author, count(distinct e.id) extrinsics, count(distinct ev.id) events, b.hash
from mbelt.blocks b
inner join mbelt.extrinsics e
on e.block_id = b.id
inner join mbelt.events ev
on  ev.block_id = b.id
where parent_id is null
group by b.id, block_time, b.era, author, hash
order by id desc
limit 10