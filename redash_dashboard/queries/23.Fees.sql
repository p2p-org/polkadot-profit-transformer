-- Fees
-- Fees
-- { "description": "", "type": "CHART", "options": { "showDataLabels": true, "direction": { "type": "clockwise" }, "missingValuesAsZero": true, "error_y": { "visible": true, "type": "data" }, "numberFormat": "0[.]00%", "yAxis": [ { "type": "linear" }, { "type": "linear", "opposite": true } ], "series": { "stacking": null, "error_y": { "visible": true, "type": "data" } }, "globalSeriesType": "pie", "percentFormat": "0[.]00%", "sortX": true, "seriesOptions": { "fee": { "zIndex": 0, "index": 0, "type": "pie", "name": "Fees", "yAxis": 0 } }, "valuesOptions": {}, "xAxis": { "labels": { "enabled": true }, "type": "-" }, "dateTimeFormat": "DD/MM/YY HH:mm", "columnMapping": { "fee": "y", "validators": "x" }, "textFormat": "", "customCode": "// Available variables are x, ys, element, and Plotly\n// Type console.log(x, ys); for more info about x and ys\n// To plot your graph call Plotly.plot(element, ...)\n// Plotly examples and docs: https://plot.ly/javascript/", "legend": { "enabled": false } }, "name": "Fees", "query_id": 20 }
-- { "options": { "parameterMappings": {}, "isHidden": false, "position": { "autoHeight": false, "sizeX": 3, "sizeY": 8, "maxSizeY": 1000, "maxSizeX": 6, "minSizeY": 5, "minSizeX": 1, "col": 3, "row": 44 } }, "text":"","width":1,"dashboard_id":1,"visualization_id":54}
select  count(distinct account_id) as validators,
        (((prefs::json->'commission')::varchar)::int) /10^7 as fee 
from dot_polka.validators
WHERE era=(SELECT max(era) FROM dot_polka.validators)
group by prefs
order by validators desc


