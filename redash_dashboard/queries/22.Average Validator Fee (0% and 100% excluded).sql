-- Average Validator Fee (0% and 100% excluded)
-- Average Validator Fee (0% and 100% excluded)
-- { "description": "", "type": "CHART", "options": { "showDataLabels": false, "direction": { "type": "counterclockwise" }, "missingValuesAsZero": true, "error_y": { "visible": true, "type": "data" }, "numberFormat": "0[.]00%", "yAxis": [ { "type": "linear" }, { "type": "linear", "opposite": true } ], "series": { "stacking": null, "error_y": { "visible": true, "type": "data" } }, "globalSeriesType": "line", "percentFormat": "0[.]00%", "sortX": true, "seriesOptions": { "fee": { "zIndex": 0, "index": 0, "type": "line", "color": "#00B6EB", "yAxis": 0 } }, "valuesOptions": {}, "xAxis": { "labels": { "enabled": true }, "type": "-" }, "dateTimeFormat": "DD/MM/YY HH:mm", "columnMapping": { "fee": "y", "era": "x" }, "textFormat": "", "customCode": "// Available variables are x, ys, element, and Plotly\n// Type console.log(x, ys); for more info about x and ys\n// To plot your graph call Plotly.plot(element, ...)\n// Plotly examples and docs: https://plot.ly/javascript/", "legend": { "enabled": false } }, "name": "Average Validator Fee (0% and 100% excluded)", "query_id": 20 }
-- { "options": { "parameterMappings": {}, "isHidden": false, "position": { "autoHeight": false, "sizeX": 3, "sizeY": 8, "maxSizeY": 1000, "maxSizeX": 6, "minSizeY": 5, "minSizeX": 1, "col": 0, "row": 44 } }, "text":"","width":1,"dashboard_id":1,"visualization_id":54}
select  era, count(distinct account_id) as validators,
        AVG((((prefs::json->'commission')::varchar)::int)) /10^7 as fee 
from dot_polka.validators
WHERE  ((prefs::json->'commission')::varchar)::int /10^7 != 100
and ((prefs::json->'commission')::varchar)::int /10^7 != 0
group by era
order by era desc



