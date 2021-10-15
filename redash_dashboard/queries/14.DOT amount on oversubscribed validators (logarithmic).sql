-- DOT amount on oversubscribed validators (logarithmic)
-- DOT amount on oversubscribed validators (logarithmic)
-- { "description": "", "type": "CHART", "options": { "showDataLabels": false, "direction": { "type": "counterclockwise" }, "missingValuesAsZero": false, "error_y": { "visible": true, "type": "data" }, "numberFormat": "0,0[.]00", "yAxis": [ { "type": "logarithmic" }, { "type": "linear", "opposite": true } ], "series": { "stacking": null, "error_y": { "visible": true, "type": "data" } }, "globalSeriesType": "line", "percentFormat": "0[.]00%", "sortX": true, "seriesOptions": { "amount": { "index": 0, "name": "DOT", "yAxis": 0, "color": "#00B6EB", "zIndex": 0, "type": "line" } }, "valuesOptions": {}, "xAxis": { "labels": { "enabled": true }, "type": "-" }, "dateTimeFormat": "DD/MM/YY HH:mm", "columnMapping": { "amount": "y", "era": "x" }, "textFormat": "", "customCode": "// Available variables are x, ys, element, and Plotly\n// Type console.log(x, ys); for more info about x and ys\n// To plot your graph call Plotly.plot(element, ...)\n// Plotly examples and docs: https://plot.ly/javascript/", "legend": { "enabled": false } }, "name": "DOT amount on oversubscribed validators (logarithmic)", "query_id": 20 }
-- {"options": { "parameterMappings": {}, "isHidden": false, "position": { "autoHeight": false, "sizeX": 3, "sizeY": 8, "maxSizeY": 1000, "maxSizeX": 6, "minSizeY": 5, "minSizeX": 1, "col": 3, "row": 73 } }, "text":"","width":1,"dashboard_id":1,"visualization_id":54}
select  era, 
        count(distinct account_id) as nominators,
        sum(value)/10^10 as amount
from nominators
where is_clipped = 'false'
group by era
order by era desc