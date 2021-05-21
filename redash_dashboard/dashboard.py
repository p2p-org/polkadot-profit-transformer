import os
import requests
import glob
import json
import http.client
from redashAPI import RedashAPIClient
from dotenv import load_dotenv

http.client._MAXLINE = 655360 * 4

load_dotenv()

redashUrl = os.getenv('REDASH_URL', 'http://localhost:5000')
setupPayload = {
    'name': os.getenv('USER_NAME', 'admin'), 'email': os.getenv('USER_EMAIL', 'admin@example.org'),
    'password': os.getenv('USER_PASS', 'supersecret123'), 'security_notifications': 'y',
    'org_name': os.getenv('ORG_NAME', 'organization')
}
setupHeaders = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,'
              'application/signed-exchange;v=b3;q=0.9'
}

setupResp = requests.post(url=redashUrl + "/setup", data=setupPayload,
                          headers=setupHeaders, allow_redirects=False)
print('User created')

ctJson = {'Content-Type': 'application/json;charset=UTF-8'}
datasourceQuery = {
    'options': {
        'host': os.getenv('DB_HOST', 'localhost'), 'port': int(os.getenv('DB_PORT', '5432')),
        'user': os.getenv('DB_USER', 'postgres'), 'password': os.getenv('DB_PASS'),
        'dbname': os.getenv('DB_NAME', 'public')
    },
    'type': os.getenv('DB_TYPE', 'pg'), 'name': os.getenv('DATASOURCE_NAME', 'default')
}

if os.getenv('DB_SSL_MODE') is not None:
    datasourceQuery['options']['sslmode'] = os.getenv('DB_SSL_MODE')

datasourceResp = requests.post(url=redashUrl + "/api/data_sources", cookies=setupResp.cookies, json=datasourceQuery,
                               headers=ctJson)
datasourceId = datasourceResp.json()['id']
print('Datasource created')

usersResp = requests.get(url=redashUrl + "/api/users/1",
                         cookies=setupResp.cookies)
apiKey = usersResp.json()['api_key']
print('Api key:', apiKey)

redash = RedashAPIClient(apiKey, redashUrl)

dashboardName = os.getenv('DASHBOARD_NAME')
dashboardResp = redash.create_dashboard(dashboardName)
dashboardId = dashboardResp.json()['id']
print('Created dashboard', dashboardName)

queriesDir = os.getenv('QRY_DIR', './')
if not queriesDir.endswith('/'):
    queriesDir += '/'

for fileName in glob.iglob(queriesDir + '*.json', recursive=True):
    f = open(fileName, "r")
    widgetJson = f.read()
    if len(widgetJson) > 0:
        widget = json.loads(widgetJson)
        widget['dashboard_id'] = dashboardId
        widgetResp = redash.post('widgets', widget)
        print('Created widget from', fileName)

for fileName in glob.iglob(queriesDir + '*.sql', recursive=True):
    f = open(fileName, "r")

    queryName = f.readline()[2:].strip()
    queryDescription = f.readline()[2:].strip()
    visualization = json.loads(f.readline()[2:].strip())
    widgetJson = f.readline()[2:].strip()
    widget = {}
    if len(widgetJson) > 3:
        widget = json.loads(widgetJson)
    query = f.read()

    queryResp = redash.create_query(
        ds_id=datasourceId, name=queryName, qry=query, desc=queryDescription)
    queryId = queryResp.json()['id']
    print('Created query', queryName, 'id:', queryId)

    if len(visualization) > 3:
        visualization['query_id'] = queryId
        visResp = redash.post('visualizations', visualization)
        visId = visResp.json()['id']
        print('Created visualisation for', queryName,
              'query. Visualization id:', visId)

        redash.generate_query_results(
            ds_id=datasourceId, qry=query, qry_id=queryId)
        print('Generated query results for', queryName, 'query.')

        publishResp = requests.post(url="{}{}{}{}".format(redashUrl, "/queries", queryId, "/source"),
                                    cookies=setupResp.cookies, headers=ctJson,
                                    data={'id': queryId, 'version': queryResp.json()['version'], 'is_draft': False})

        if len(widgetJson) > 3:
            widget['dashboard_id'] = dashboardId
            widget['visualization_id'] = visId
            widgetResp = redash.post('widgets', widget)
            print('Created widget for', queryName, 'query')

redash.publish_dashboard(dashboardId)
print('Published dashboard', dashboardName)
