module.exports = {
    'db' : {
        'host'     : 'localhost',
        'user'     : 'elgg',
        'password' : 'elgg',
        'database' : 'elgg',
        'prefix'   : 'elgg_'
    },
    'skip_events' : [
        'login:after',
        'login:before',
        'update:after'
    ]
};