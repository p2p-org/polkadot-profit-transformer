-- Active Nominators (logarithmic)
-- Active Nominators (logarithmic)
-- { "description": "", "type": "CHART", "options": { "showDataLabels": false, "direction": { "type": "counterclockwise" }, "missingValuesAsZero": true, "error_y": { "visible": true, "type": "data" }, "numberFormat": "0,0[.]00000", "yAxis": [ { "type": "logarithmic" }, { "type": "linear", "opposite": true } ], "series": { "stacking": null, "error_y": { "visible": true, "type": "data" } }, "globalSeriesType": "line", "percentFormat": "0[.]00%", "sortX": true, "seriesOptions": { "nominators": { "zIndex": 0, "index": 0, "type": "line", "color": "#00B6EB", "yAxis": 0 } }, "valuesOptions": {}, "xAxis": { "labels": { "enabled": true }, "type": "-" }, "dateTimeFormat": "DD/MM/YY HH:mm", "columnMapping": { "nominators": "y", "era": "x" }, "textFormat": "", "customCode": "// Available variables are x, ys, element, and Plotly\n// Type console.log(x, ys); for more info about x and ys\n// To plot your graph call Plotly.plot(element, ...)\n// Plotly examples and docs: https://plot.ly/javascript/", "legend": { "enabled": false } }, "name": "Active Nominators (logarithmic)" , "query_id": 20 }
-- {"options": { "parameterMappings": {}, "isHidden": false, "position": { "autoHeight": false, "sizeX": 3, "sizeY": 8, "maxSizeY": 1000, "maxSizeX": 6, "minSizeY": 5, "minSizeX": 1, "col": 0, "row": 65 } }, "text":"","width":1,"dashboard_id":1,"visualization_id":54}
select  era, 
        count(distinct account_id) as nominators, 
         --count(CASE WHEN is_clipped = 'false' THEN 'clipped' END) as clipped,
        max(value)/10^10 as max_stake,
        avg(value)/10^10 as avg_stake, 
        min(value)/10^10 as min_stake
from nominators
group by era 
order by era desc