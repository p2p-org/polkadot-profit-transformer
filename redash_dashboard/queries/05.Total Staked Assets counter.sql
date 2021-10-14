-- Total Staked Assets
-- Total Staked Assets
-- { "description": "", "type": "COUNTER", "options": { "tooltipFormat": "0,0.000", "targetColName": "", "rowNumber": 1, "stringDecChar": ".", "stringDecimal": 0, "counterColName": "total_stake", "counterLabel": "", "stringThouSep": ",", "targetRowNumber": null }, "name": "Total Staked Assets", "query_id": 20 }
-- {"options": { "parameterMappings": {}, "isHidden": false, "position": { "autoHeight": false, "sizeX": 2, "sizeY": 5, "maxSizeY": 1000, "maxSizeX": 6, "minSizeY": 1, "minSizeX": 1, "col": 0, "row": 15 } }, "text":"","width":1,"dashboard_id":1,"visualization_id":54}
WITH data as (
Select  e.era,
        validators_active,
        nominator_active,
        total_reward/10^10 as total_reward, 
        total_stake/10^10 as total_stake, 
        total_reward_points,
        total_reward_points/validators_active as avg_points, 
        (total_reward/validators_active)/10^10 as avg_rewards
FROM mbelt.eras as e
    INNER JOIN (SELECT era, COUNT(account_id) as validators_active FROM mbelt.validators GROUP BY era) as vmax 
            ON vmax.era = e.era
    INNER JOIN (SELECT era, COUNT(account_id) as nominator_active FROM mbelt.nominators GROUP BY era) as nmax 
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


