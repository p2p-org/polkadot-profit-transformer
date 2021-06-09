-- Min/Avg Staked Ratio
-- Min/Avg Staked Ratio
-- { "description": "", "type": "CHART", "options": { "showDataLabels": false, "direction": { "type": "counterclockwise" }, "missingValuesAsZero": true, "error_y": { "visible": true, "type": "data" }, "numberFormat": "0[.]00%", "yAxis": [ { "type": "linear" }, { "type": "linear", "opposite": true } ], "series": { "stacking": null, "error_y": { "visible": true, "type": "data" } }, "globalSeriesType": "line", "percentFormat": "0[.]00%", "sortX": true, "seriesOptions": { "ratio_min_to_avg": { "zIndex": 0, "index": 0, "type": "line", "color": "#00B6EB", "yAxis": 0 } }, "valuesOptions": {}, "xAxis": { "labels": { "enabled": true }, "type": "-" }, "dateTimeFormat": "DD/MM/YY HH:mm", "columnMapping": { "era": "x", "ratio_min_to_avg": "y" }, "textFormat": "", "customCode": "// Available variables are x, ys, element, and Plotly\n// Type console.log(x, ys); for more info about x and ys\n// To plot your graph call Plotly.plot(element, ...)\n// Plotly examples and docs: https://plot.ly/javascript/", "legend": { "enabled": false } }, "name": "Min/Avg Staked Ratio" , "query_id": 20 }
-- { "options": { "parameterMappings": {}, "isHidden": false, "position": { "autoHeight": false, "sizeX": 3, "sizeY": 8, "maxSizeY": 1000, "maxSizeX": 6, "minSizeY": 5, "minSizeX": 1, "col": 3, "row": 52 } }, "text":"","width":1,"dashboard_id":1,"visualization_id":54}
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
FROM dot_polka.validators
GROUP BY era)

SELECT era, total_stake, max, avg, min, min / avg * 100 as ratio_min_to_avg
FROM eras_validators 
WHERE era != 0
ORDER BY era desc


