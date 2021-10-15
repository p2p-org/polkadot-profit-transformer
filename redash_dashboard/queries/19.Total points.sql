-- Total points
-- Total points
-- { "description": "", "type": "CHART", "options": { "showDataLabels": false, "direction": { "type": "counterclockwise" }, "missingValuesAsZero": true, "error_y": { "visible": true, "type": "data" }, "numberFormat": "0,0[.]00", "yAxis": [ { "type": "linear" }, { "type": "linear", "opposite": true } ], "series": { "stacking": null, "error_y": { "visible": true, "type": "data" } }, "globalSeriesType": "line", "percentFormat": "0[.]00%", "sortX": true, "seriesOptions": { "total_reward_points": { "index": 0, "name": "Points", "yAxis": 0, "color": "#00B6EB", "zIndex": 0, "type": "line" } }, "valuesOptions": {}, "xAxis": { "labels": { "enabled": true }, "type": "-" }, "reverseY": false, "dateTimeFormat": "DD/MM/YY HH:mm", "columnMapping": { "total_reward_points": "y", "total_reward": "unused", "era": "x" }, "textFormat": "", "customCode": "// Available variables are x, ys, element, and Plotly\n// Type console.log(x, ys); for more info about x and ys\n// To plot your graph call Plotly.plot(element, ...)\n// Plotly examples and docs: https://plot.ly/javascript/", "legend": { "enabled": false } }, "name": "Total points", "query_id": 20 }
-- { "options": { "parameterMappings": {}, "isHidden": false, "position": { "autoHeight": false, "sizeX": 3, "sizeY": 8, "maxSizeY": 1000, "maxSizeX": 6, "minSizeY": 5, "minSizeX": 1, "col": 0, "row": 36 } }, "text":"","width":1,"dashboard_id":1,"visualization_id":54}
WITH data as (
Select  e.era,
        validators_active,
        nominator_active,
        total_reward/10^10 as total_reward, 
        total_stake/10^10 as total_stake, 
        total_reward_points,
        total_reward_points/validators_active as avg_points, 
        (total_reward/validators_active)/10^10 as avg_rewards
FROM eras as e
    INNER JOIN (SELECT era, COUNT(account_id) as validators_active FROM validators GROUP BY era) as vmax 
            ON vmax.era = e.era
    INNER JOIN (SELECT era, COUNT(account_id) as nominator_active FROM nominators GROUP BY era) as nmax 
            ON nmax.era = e.era)
SELECT  era,
        validators_active,
        nominator_active,
        total_reward,
        total_stake,
        total_reward_points,
        nominator_active/validators_active as nom_per_val,
        avg_points,
        avg_rewards
FROM data
order by era desc

