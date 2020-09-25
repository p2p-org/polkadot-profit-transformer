const oas = require('fastify-swagger');

const apiRoutes = async (app, options) => {
    app.register(oas, require('./swagger'));
    app.register(require('./api/blocks'), {prefix: 'blocks'});
    app.get('/', async (request, reply) => {
        return {hello: 'world'};
    });
};

module.exports = apiRoutes;