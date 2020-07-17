const http = require('http');
const { ApiPromise, WsProvider } = require('@polkadot/api');
const config = require('./config.json');
const util = require('util');
const readline = require('readline');
const { hexToString } = require('@polkadot/util');
const { Client } = require('pg');
const { hasUncaughtExceptionCaptureCallback } = require('process');

async function main() {
    const wsProvider = new WsProvider(config.substrate_uri);
    const api = await ApiPromise.create({ provider: wsProvider });

    const client = new Client({
        user: config.db.user,
        host: config.db.host,
        database: config.db.database,
        password: config.db.password,
        port: config.db.port,
    });
    client.connect();

    var data = {
        "ksql": "select ACCOUNT_ID from BALANCES_WITH_IS_VALIDATOR EMIT CHANGES;",
        "streamsProperties": {
          "ksql.streams.auto.offset.reset": "latest"
        }
    }
    var dataEncoded = JSON.stringify(data);

    async function upsertIdentity(accountID, identity) {
        console.log(`Inserting identinty for ${accountID}`);
        await client
            .query(`INSERT INTO account_identity 
                                (account_id, display, legal, web, riot, email, twitter) 
                            VALUES ($1, $2, $3, $4, $5, $6, $7) 
                            ON CONFLICT (account_id) 
                            DO 
                                UPDATE SET display=$2, legal=$3, web=$4, riot=$5, email=$6, twitter=$7`,
                                [accountID, hexToString(identity.value.info.display.asRaw.toHex()),
                                    hexToString(identity.value.info.legal.asRaw.toHex()),
                                    hexToString(identity.value.info.web.asRaw.toHex()),
                                    hexToString(identity.value.info.riot.asRaw.toHex()),
                                    hexToString(identity.value.info.email.asRaw.toHex()),
                                    hexToString(identity.value.info.twitter.asRaw.toHex())])
            .then(res => {
                console.log("Success");
            })
            .catch(err => {
                console.error(err);
            });
    }

    async function getIdentity(accountID) {
        var identity = await api.query.identity.identityOf(accountID);
        if (identity.isEmpty) {
            var superAccount = await api.query.identity.superOf(accountID);
            if (superAccount.isEmpty) {
                return null;
            }
            var superIdentity = await getIdentity(superAccount.value[0].toString());
            return superIdentity;
        }
        return identity;
    }

    async function handleLine(line) {
        if ((line == "") || (line.includes("queryId"))) {
            return;
        }
        row = JSON.parse(line.substr(0, line.length-1))
        var accountID = row.row.columns[0];
        console.log(`got ${accountID}`);
        var identity = await getIdentity(accountID);
        if (!identity) {
            return;
        }
        await upsertIdentity(accountID, identity);
    }


    var req = http.request(
        {
          host: config.ksql_rest.host,
          path: config.ksql_rest.path,
          port: config.ksql_rest.port,
          method: 'POST',
          headers: {
            'Content-Length': Buffer.byteLength(dataEncoded),
            'Content-Type': 'application/json',
          },
        },
        function(res) {
            var interface = readline.createInterface({input: res});
            interface.on('line', function(line) {
                handleLine(line);
            })
        }
      );
      req.write(dataEncoded);
      req.end();
}

main()