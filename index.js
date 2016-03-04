var config = require('./config');
var tmp = require('tmp');
var fs = require('fs');
var cat = require('concat-files');
var xmlescape = require('xml-escape');
var mysql = require('mysql');
var connection = mysql.createConnection(config.db);

// connect to mysql server
connection.connect();

// data structure for progress status
var status = {
    'header'       : false,
    'nodes'        : false,
    'deadnodes'    : false,
    'meta_nodes'   : false,
    'anno_nodes'   : false,
    'deadmeta'     : false,
    'deadanno'     : false,
    'access_nodes' : false,
    'middle'       : false,
    'edges1'       : false,
    'edges2'       : false,
    'edges3'       : false,
    'meta_edges'   : false,
    'anno_edges'   : false,
    'access_edges' : false,
    'footer'       : false
};

var csv_nodes = fs.createWriteStream('./elgg_nodes.csv');
var csv_edges;
csv_nodes.on("finish", function() {
    console.log("The file 'elgg_nodes.csv' is ready and contains all nodes");
});
csv_nodes.on("open", function() {
    csv_nodes.write("id;label;type;description\n", 'utf-8', function() {

        csv_edges = fs.createWriteStream('./elgg_edges.csv');
        csv_edges.on("finish", function() {
            console.log("The file 'elgg_edges.csv' is ready and contains all edges");
        });
        csv_edges.on("open", function() {
            csv_edges.write("id;source;target;type;label;weight;relation\n", 'utf-8', resume);
        });
    });
});

function resume() {
    /**
     * generate nodes and node based edges
     */
    tmp.file(function _tempFileCreated(err, path_nodes, fd_nodes, cleanupCallback) {
        if (err) throw err;

        var nodes = fs.createWriteStream(null, {fd: fd_nodes});
        nodes.on("finish", function() {
            status.nodes = path_nodes;
        });

        tmp.file(function _tempFileCreated(err, path_edges, fd_edges, cleanupCallback) {

            var edges = fs.createWriteStream(null, {fd: fd_edges});
            edges.on("finish", function() {
                status.edges1 = path_edges;
            });

            var query = connection.query("SELECT DISTINCT entities.guid, COALESCE(entity_subtypes.subtype, entities.type) AS type, entities.owner_guid, entities.site_guid, entities.container_guid, entities.access_id, COALESCE(NULLIF(objects_entity.title, ''), users_entity.username, NULLIF(groups_entity.name, ''), NULLIF(sites_entity.name, ''), 'Untitled') AS title, COALESCE(NULLIF(objects_entity.description, ''), CONCAT('The userprofile of ', users_entity.name), NULLIF(groups_entity.description, ''), NULLIF(sites_entity.description, ''), 'No description available') AS description FROM " + config.db.prefix + "entities entities LEFT JOIN " + config.db.prefix + "entity_subtypes entity_subtypes ON entities.subtype = entity_subtypes.id LEFT JOIN " + config.db.prefix + "objects_entity objects_entity ON objects_entity.guid = entities.guid LEFT JOIN " + config.db.prefix + "users_entity users_entity ON users_entity.guid = entities.guid LEFT JOIN " + config.db.prefix + "groups_entity groups_entity ON groups_entity.guid = entities.guid LEFT JOIN " + config.db.prefix + "sites_entity sites_entity ON sites_entity.guid = entities.guid");
            query
                .on('error', function (err) {
                    throw err;
                })
                .on('result', function (row) {
                    connection.pause();

                    var node_xml = '<node id="' + parseInt(row.guid) + '" label="' + xmlescape(row.title) + '"><attvalues><attvalue for="0" value="' + xmlescape(row.type) + '"/><attvalue for="1" value="' + xmlescape(row.description) + '"/></attvalues></node>';
                    var node_csv = '"' + parseInt(row.guid) + '";"' + row.title.replace('"', "''") + '";"' + row.type.replace('"', "''") + '";"' + row.description.replace('"', "''") + '"\n';

                    nodes.write(node_xml, 'utf-8', function () {
                        csv_nodes.write(node_csv, 'utf-8', function() {
                            var edges_xml = "";
                            var edges_csv = "";

                            if(row.container_guid != row.guid && row.container_guid != 0) {
                                edges_xml += '<edge id="' + parseInt(row.container_guid) + '_contains_' + parseInt(row.guid) + '" source="' + parseInt(row.container_guid) + '" target="' + parseInt(row.guid) + '" label="contains"><attvalues><attvalue for="0" value="contains"/></attvalues></edge>';
                                edges_csv += '"' + parseInt(row.container_guid) + '_contains_' + parseInt(row.guid) + '";"' + parseInt(row.container_guid) + '";"' + parseInt(row.guid) + '";"directed";"contains";"1.0";"contains"\n';
                            }
                            if(row.site_guid != row.guid) {
                                edges_xml += '<edge id="' + parseInt(row.guid) + '_in_site_' + parseInt(row.site_guid) + '" source="' + parseInt(row.guid) + '" target="' + parseInt(row.site_guid) + '" label="in_site"><attvalues><attvalue for="0" value="in site"/></attvalues></edge>';
                                edges_csv += '"' + parseInt(row.guid) + '_in_site_' + parseInt(row.site_guid) + '";"' + parseInt(row.guid) + '";"' + parseInt(row.site_guid) + '";"directed";"in_site";"1.0";"in site"\n';
                            }
                            if(row.owner_guid != 0 && row.owner_guid != row.guid) {
                                edges_xml += '<edge id="' + parseInt(row.owner_guid) + '_owns_' + parseInt(row.guid) + '" source="' + parseInt(row.owner_guid) + '" target="' + parseInt(row.guid) + '" label="owns"><attvalues><attvalue for="0" value="owns"/></attvalues></edge>';
                                edges_csv += '"' + parseInt(row.owner_guid) + '_owns_' + parseInt(row.guid) + '";"' + parseInt(row.owner_guid) + '";"' + parseInt(row.guid) + '";"directed";"owns";"1.0";"owns"\n';
                            }
                            edges_xml += '<edge id="' + parseInt(row.guid) + '_accessable_by_access_' + parseInt(row.access_id) + '" source="' + parseInt(row.guid) + '" target="access_' + parseInt(row.access_id) + '" label="accessable_by"><attvalues><attvalue for="0" value="accessable by"/></attvalues></edge>';
                            edges_csv += '"' + parseInt(row.guid) + '_accessable_by_access_' + parseInt(row.access_id) + '";"' + parseInt(row.guid) + '";"access_' + parseInt(row.access_id) + '";"directed";"accessable_by";"1.0";"accessable by"\n';

                            edges.write(edges_xml, 'utf-8', function() {
                                csv_edges.write(edges_csv, 'utf-8', function() {
                                    connection.resume();
                                });
                            });
                        });
                    });
                })
                .on('end', function () {
                    nodes.end();
                    edges.end();
                });
        });
    });

    /**
     * generate relationship edges
     */
    tmp.file(function _tempFileCreated(err, path, fd, cleanupCallback) {
        var edges = fs.createWriteStream(null, {fd: fd});
        edges.on("finish", function() {
            status.edges2 = path;
        });

        var query = connection.query("SELECT COUNT(*) as weight, `guid_one`, `relationship`, `guid_two` FROM `" + config.db.prefix + "entity_relationships` GROUP BY `guid_one`, `relationship`, `guid_two`");
        query
            .on('error', function (err) {
                throw err;
            })
            .on('result', function (row) {
                connection.pause();

                var edge_xml = '<edge id="' + parseInt(row.guid_one) + '_' + xmlescape(row.relationship) + '_' + parseInt(row.guid_two) + '" source="' + parseInt(row.guid_one) + '" target="' + parseInt(row.guid_two) + '" weight="' + parseInt(row.weight) + '" label="' + xmlescape(row.relationship) + '"><attvalues><attvalue for="0" value="' + xmlescape(row.relationship) + '"/></attvalues></edge>';
                var edge_csv = '"' + parseInt(row.guid_one) + '_' + row.relationship.replace('"', "''") + '_' + parseInt(row.guid_two) + '";"' + parseInt(row.guid_one) + '";"' + parseInt(row.guid_two) + '";"directed";"' + row.relationship.replace('"', "''") + '";"' + parseInt(row.weight) + '";"' + row.relationship.replace('"', "''") + '"\n';

                edges.write(edge_xml, 'utf-8', function () {
                    csv_edges.write(edge_csv, 'utf-8', function() {
                        connection.resume();
                    });
                });
            })
            .on('end', function () {
                edges.end();
            });
    });

    /**
     * find deleted (dead) entities in system log
     */
    tmp.file(function _tempFileCreated(err, path, fd, cleanupCallback) {
        var nodes = fs.createWriteStream(null, {fd: fd});
        nodes.on("finish", function() {
            status.deadnodes = path;
        });

        var query = connection.query("SELECT DISTINCT `system_log`.`object_id` AS guid, COALESCE(NULLIF(`system_log`.`object_type`, 'object'), `system_log`.`object_subtype`) AS type FROM " + config.db.prefix + "system_log system_log LEFT JOIN " + config.db.prefix + "entities entities ON `system_log`.`object_id`=`entities`.`guid` WHERE `entities`.`guid` IS NULL AND `system_log`.`object_type` IN ('object', 'user', 'group', 'site')");
        query
            .on('error', function (err) {
                throw err;
            })
            .on('result', function (row) {
                connection.pause();

                var node_xml = '<node id="' + parseInt(row.guid) + '" label="' + xmlescape(row.type) + '_' + parseInt(row.guid) + '"><attvalues><attvalue for="0" value="' + xmlescape(row.type) + '"/><attvalue for="1" value="This object was deleted and only found in the system log"/></attvalues></node>';
                var node_csv = '"' + parseInt(row.guid) + '";"' + row.type.replace('"', "''") + '_' + parseInt(row.guid) + '";"' + row.type.replace('"', "''") + '";"This object was deleted and only found in the system log"\n';

                nodes.write(node_xml, 'utf-8', function () {
                    csv_nodes.write(node_csv, 'utf-8', function() {
                        connection.resume();
                    });
                });
            })
            .on('end', function () {
                nodes.end();
            });
    });

    /**
     * generate edges from system log
     */
    tmp.file(function _tempFileCreated(err, path, fd, cleanupCallback) {
        var edges = fs.createWriteStream(null, {fd: fd});
        edges.on("finish", function() {
            status.edges3 = path;
        });

        var query = connection.query("SELECT COUNT(*) AS weight, `performed_by_guid`, `object_id`, `event`, `object_type` FROM `" + config.db.prefix + "system_log` WHERE `event` NOT IN ('" + config.skip_events.join("', '") + "') AND `performed_by_guid` != 0 AND `object_type`!='relationship' GROUP BY `performed_by_guid`, `object_type`, `object_id`, `event`");
        query
            .on('error', function (err) {
                throw err;
            })
            .on('result', function (row) {
                connection.pause();

                var target = parseInt(row.object_id);
                if(row.object_type == "annotation") target = "annotation_" + target;
                else if(row.object_type == "metadata") target = "meta_" + target;

                var edge_xml = '<edge id="' + parseInt(row.performed_by_guid) + '_' + xmlescape(row.event) + '_' + target + '" source="' + parseInt(row.performed_by_guid) + '" target="' + target + '" weight="' + parseInt(row.weight) + '" label="' + xmlescape(row.event) + '"><attvalues><attvalue for="0" value="' + xmlescape(row.event) + '"/></attvalues></edge>';
                var edge_csv = '"' + parseInt(row.performed_by_guid) + '_' + row.event.replace('"', "''") + '_' + target + '";"' + parseInt(row.performed_by_guid) + '";"' + target + '";"directed";"' + row.event.replace('"', "''") + '";"' + parseInt(row.weight) + '";"' + row.event.replace('"', "''") + '"\n';

                edges.write(edge_xml, 'utf-8', function () {
                    csv_edges.write(edge_csv, 'utf-8', function() {
                        connection.resume();
                    });
                });
            })
            .on('end', function () {
                edges.end();
            });
    });

    /**
     * generate metadata nodes and metadata edges
     */
    tmp.file(function _tempFileCreated(err, path_nodes, fd_nodes, cleanupCallback) {
        var nodes = fs.createWriteStream(null, {fd: fd_nodes});
        nodes.on("finish", function() {
            status.meta_nodes = path_nodes;
        });

        tmp.file(function _tempFileCreated(err, path_edges, fd_edges, cleanupCallback) {
            var edges = fs.createWriteStream(null, {fd: fd_edges});
            edges.on("finish", function () {
                status.meta_edges = path_edges;
            });

            var query = connection.query("SELECT `metadata`.`id`, `metadata`.`entity_guid`, `metadata`.`owner_guid`, `metadata`.`access_id`, `name`.`string` AS name, `value`.`string` as value FROM " + config.db.prefix + "metadata metadata LEFT JOIN " + config.db.prefix + "metastrings name ON `name`.`id`=`metadata`.`name_id` LEFT JOIN " + config.db.prefix + "metastrings value ON `value`.`id`=`metadata`.`value_id` WHERE `metadata`.`owner_guid`!=0 AND `metadata`.`entity_guid`!=0");
            query
                .on('error', function (err) {
                    throw err;
                })
                .on('result', function (row) {
                    connection.pause();

                    var node_xml = '<node id="meta_' + parseInt(row.id) + '" label="' + xmlescape(row.name) + '=' + xmlescape(row.value) + '"><attvalues><attvalue for="0" value="Metadata"/><attvalue for="1" value="Metadata for Entity ' + parseInt(row.entity_guid) + '"/></attvalues></node>';
                    var node_csv = '"meta_' + parseInt(row.id) + '";"' + row.name.replace('"', "''") + '=' + row.value.replace('"', "''") + '";"Metadata";"Metadata for Entity ' + parseInt(row.entity_guid) + '"\n';

                    nodes.write(node_xml, 'utf-8', function () {
                        csv_nodes.write(node_csv, 'utf-8', function() {
                            var edges_xml = '<edge id="' + parseInt(row.entity_guid) + '_has_metadata_' + parseInt(row.id) + '" source="' + parseInt(row.entity_guid) + '" target="meta_' + parseInt(row.id) + '" weight="1" label="has_metadata"><attvalues><attvalue for="0" value="has_metadata"/></attvalues></edge>';
                            edges_xml += '<edge id="' + parseInt(row.owner_guid) + '_owns_metadata_' + parseInt(row.id) + '" source="' + parseInt(row.owner_guid) + '" target="meta_' + parseInt(row.id) + '" weight="1" label="owns_metadata"><attvalues><attvalue for="0" value="owns_metadata"/></attvalues></edge>';
                            if(row.access_id != "0") edges_xml += '<edge id="meta_' + parseInt(row.id) + '_accessable_by_access_' + parseInt(row.access_id) + '" source="meta_' + parseInt(row.id) + '" target="access_' + parseInt(row.access_id) + '" label="accessable_by"><attvalues><attvalue for="0" value="accessable by"/></attvalues></edge>';
                            var edges_csv = '"' + parseInt(row.entity_guid) + '_has_metadata_' + parseInt(row.id) + '";"' + parseInt(row.entity_guid) + '";"meta_' + parseInt(row.id) + '";"directed";"has_metadata";"1";"has_metadata"\n';
                            edges_csv += '"' + parseInt(row.owner_guid) + '_owns_metadata_' + parseInt(row.id) + '";"' + parseInt(row.owner_guid) + '";"meta_' + parseInt(row.id) + '";"directed";"owns_metadata";"1";"owns_metadata"\n';
                            if(row.access_id != "0") edges_csv += '"meta_' + parseInt(row.id) + '_accessable_by_access_' + parseInt(row.access_id) + '";"meta_' + parseInt(row.id) + '";"access_' + parseInt(row.access_id) + '";"directed";"accessable_by";"1.0";"accessable by"\n';

                            edges.write(edges_xml, 'utf-8', function () {
                                csv_edges.write(edges_csv, 'utf-8', function () {
                                    connection.resume();
                                });
                            });

                        });
                    });
                })
                .on('end', function () {
                    edges.end();
                    nodes.end();
                });
        });
    });

    /**
     * generate annotation nodes and annotation edges
     */
    tmp.file(function _tempFileCreated(err, path_nodes, fd_nodes, cleanupCallback) {
        var nodes = fs.createWriteStream(null, {fd: fd_nodes});
        nodes.on("finish", function() {
            status.anno_nodes = path_nodes;
        });

        tmp.file(function _tempFileCreated(err, path_edges, fd_edges, cleanupCallback) {
            var edges = fs.createWriteStream(null, {fd: fd_edges});
            edges.on("finish", function () {
                status.anno_edges = path_edges;
            });

            var query = connection.query("SELECT `annotation`.`id`, `annotation`.`entity_guid`, `annotation`.`owner_guid`, `annotation`.`access_id`, `name`.`string` AS name, `value`.`string` as value FROM " + config.db.prefix + "annotations annotation LEFT JOIN " + config.db.prefix + "metastrings name ON `name`.`id`=`annotation`.`name_id` LEFT JOIN " + config.db.prefix + "metastrings value ON `value`.`id`=`annotation`.`value_id`");
            query
                .on('error', function (err) {
                    throw err;
                })
                .on('result', function (row) {
                    connection.pause();

                    var node_xml = '<node id="annotation_' + parseInt(row.id) + '" label="' + xmlescape(row.name) + '"><attvalues><attvalue for="0" value="Annotation"/><attvalue for="1" value="' + xmlescape(row.value) + '"/></attvalues></node>';
                    var node_csv = '"annotation_' + parseInt(row.id) + '";"' + row.name.replace('"', "''") + '";"Annotation";"' + row.value.replace('"', "''") + '"\n';

                    nodes.write(node_xml, 'utf-8', function () {
                        csv_nodes.write(node_csv, 'utf-8', function() {
                            var edges_xml = '<edge id="' + parseInt(row.entity_guid) + '_has_annotation_' + parseInt(row.id) + '" source="' + parseInt(row.entity_guid) + '" target="annotation_' + parseInt(row.id) + '" weight="1" label="has_annotation"><attvalues><attvalue for="0" value="has_annotation"/></attvalues></edge>';
                            edges_xml += '<edge id="' + parseInt(row.owner_guid) + '_owns_annotation_' + parseInt(row.id) + '" source="' + parseInt(row.owner_guid) + '" target="annotation_' + parseInt(row.id) + '" weight="1" label="owns_annotation"><attvalues><attvalue for="0" value="owns_annotation"/></attvalues></edge>';
                            if(row.access_id != "0") edges_xml += '<edge id="annotation_' + parseInt(row.id) + '_accessable_by_access_' + parseInt(row.access_id) + '" source="annotation_' + parseInt(row.id) + '" target="access_' + parseInt(row.access_id) + '" label="accessable_by"><attvalues><attvalue for="0" value="accessable by"/></attvalues></edge>';
                            var edges_csv = '"' + parseInt(row.entity_guid) + '_has_annotation_' + parseInt(row.id) + '";"' + parseInt(row.entity_guid) + '";"annotation_' + parseInt(row.id) + '";"directed";"has_annotation";"1";"has_annotation"\n';
                            edges_csv += '"' + parseInt(row.owner_guid) + '_owns_annotation_' + parseInt(row.id) + '";"' + parseInt(row.owner_guid) + '";"annotation_' + parseInt(row.id) + '";"directed";"owns_annotation";"1";"owns_annotation"\n';
                            if(row.access_id != "0") edges_csv += '"annotation_' + parseInt(row.id) + '_accessable_by_access_' + parseInt(row.access_id) + '";"annotation_' + parseInt(row.id) + '";"access_' + parseInt(row.access_id) + '";"directed";"accessable_by";"1.0";"accessable by"\n';

                            edges.write(edges_xml, 'utf-8', function () {
                                csv_edges.write(edges_csv, 'utf-8', function () {
                                    connection.resume();
                                });
                            });

                        });
                    });
                })
                .on('end', function () {
                    edges.end();
                    nodes.end();
                });
        });
    });

    /**
     * find deleted (dead) metadata nodes in system log
     */
    tmp.file(function _tempFileCreated(err, path, fd, cleanupCallback) {
        var nodes = fs.createWriteStream(null, {fd: fd});
        nodes.on("finish", function() {
            status.deadmeta = path;
        });

        var query = connection.query("SELECT DISTINCT CONCAT('meta_', `system_log`.`object_id`) AS id, `system_log`.`object_type` FROM " + config.db.prefix + "system_log system_log LEFT JOIN " + config.db.prefix + "metadata meta ON `system_log`.`object_id`=`meta`.`id` WHERE `meta`.`id` IS NULL AND `system_log`.`object_type`='metadata'");
        query
            .on('error', function (err) {
                throw err;
            })
            .on('result', function (row) {
                connection.pause();

                var node_xml = '<node id="' + xmlescape(row.id) + '" label="Deleted Metadata"><attvalues><attvalue for="0" value="Metadata"/><attvalue for="1" value="This object was deleted and only found in the system log"/></attvalues></node>';
                var node_csv = '"' + row.id.replace('"', "''") + '";"Deleted Metadata";"Metadata";"This object was deleted and only found in the system log"\n';

                nodes.write(node_xml, 'utf-8', function () {
                    csv_nodes.write(node_csv, 'utf-8', function() {
                        connection.resume();
                    });
                });
            })
            .on('end', function () {
                nodes.end();
            });
    });

    /**
     * find deleted (dead) annotation nodes in system log
     */
    tmp.file(function _tempFileCreated(err, path, fd, cleanupCallback) {
        var nodes = fs.createWriteStream(null, {fd: fd});
        nodes.on("finish", function() {
            status.deadanno = path;
        });

        var query = connection.query("SELECT DISTINCT CONCAT('annotation_', `system_log`.`object_id`) AS id, `system_log`.`object_type` FROM " + config.db.prefix + "system_log system_log LEFT JOIN " + config.db.prefix + "annotations annotations ON `system_log`.`object_id`=`annotations`.`id` WHERE `annotations`.`id` IS NULL AND `system_log`.`object_type`='annotation'");
        query
            .on('error', function (err) {
                throw err;
            })
            .on('result', function (row) {
                connection.pause();

                var node_xml = '<node id="' + xmlescape(row.id) + '" label="Deleted Annotation"><attvalues><attvalue for="0" value="annotation"/><attvalue for="1" value="This object was deleted and only found in the system log"/></attvalues></node>';
                var node_csv = '"' + row.id.replace('"', "''") + '";"Deleted Annotation";"annotation";"This object was deleted and only found in the system log"\n';

                nodes.write(node_xml, 'utf-8', function () {
                    csv_nodes.write(node_csv, 'utf-8', function() {
                        connection.resume();
                    });
                });
            })
            .on('end', function () {
                nodes.end();
            });
    });

    /**
     * generate access collection nodes and edges
     */
    tmp.file(function _tempFileCreated(err, path_nodes, fd_nodes, cleanupCallback) {
        var other_finished = false;

        var nodes = fs.createWriteStream(null, {fd: fd_nodes});
        nodes.on("finish", function() {
            status.access_nodes = path_nodes;
        });

        tmp.file(function _tempFileCreated(err, path_edges, fd_edges, cleanupCallback) {
            var edges = fs.createWriteStream(null, {fd: fd_edges});
            edges.on("finish", function () {
                status.access_edges = path_edges;
            });

            var query = connection.query("SELECT `id`, `name`, `owner_guid`, `site_guid` FROM `" + config.db.prefix + "access_collections`");
            query
                .on('error', function (err) {
                    throw err;
                })
                .on('result', function (row) {
                    connection.pause();

                    var node_xml = '<node id="access_' + parseInt(row.id) + '" label="' + xmlescape(row.name) + '"><attvalues><attvalue for="0" value="access_collection"/><attvalue for="1" value="Access Collection"/></attvalues></node>';
                    var node_csv = '"access_' + parseInt(row.id) + '";"' + row.name.replace('"', "''") + '";"access_collection";"Access Collection"\n';

                    nodes.write(node_xml, 'utf-8', function () {
                        csv_nodes.write(node_csv, 'utf-8', function() {
                            var edges_xml = '<edge id="access_' + parseInt(row.id) + '_in_site_' + parseInt(row.site_guid) + '" source="access_' + parseInt(row.id) + '" target="' + parseInt(row.site_guid) + '" weight="1" label="in_site"><attvalues><attvalue for="0" value="in_site"/></attvalues></edge>';
                            edges_xml += '<edge id="' + parseInt(row.owner_guid) + '_owns_access_' + parseInt(row.id) + '" source="' + parseInt(row.owner_guid) + '" target="access_' + parseInt(row.id) + '" weight="1" label="owns_access"><attvalues><attvalue for="0" value="owns_access"/></attvalues></edge>';
                            var edges_csv = '"access_' + parseInt(row.id) + '_in_site_' + parseInt(row.site_guid) + '";"access_' + parseInt(row.id) + '";"' + parseInt(row.site_guid) + '";"directed";"in_site";"1";"in_site"\n';
                            edges_csv += '"' + parseInt(row.owner_guid) + '_owns_access' + parseInt(row.id) + '";"' + parseInt(row.owner_guid) + '";"access_' + parseInt(row.id) + '";"directed";"owns_access";"1";"owns_access"\n';

                            edges.write(edges_xml, 'utf-8', function () {
                                csv_edges.write(edges_csv, 'utf-8', function () {
                                    connection.resume();
                                });
                            });

                        });
                    });
                })
                .on('end', function () {
                    if(other_finished) {
                        edges.end();
                    } else {
                        other_finished = true;
                    }
                    nodes.end();
                });
            var query2 = connection.query("SELECT `user_guid`, `access_collection_id` FROM `" + config.db.prefix + "access_collection_membership`");
            query2
                .on('error', function (err) {
                    throw err;
                })
                .on('result', function (row) {
                    connection.pause();

                    var edge_xml = '<edge id="' + parseInt(row.user_guid) + '_in_access_' + parseInt(row.access_collection_id) + '" source="' + parseInt(row.user_guid) + '" target="access_' + parseInt(row.access_collection_id) + '" weight="1" label="in_access_collection"><attvalues><attvalue for="0" value="in_access_collection"/></attvalues></edge>';
                    var edge_csv = '"' + parseInt(row.user_guid) + '_in_access_' + parseInt(row.access_collection_id) + '";"' + parseInt(row.user_guid) + '";"access_' + parseInt(row.access_collection_id) + '";"directed";"in_access_collection";"1";"in_access_collection"\n';

                    edges.write(edge_xml, 'utf-8', function () {
                        csv_edges.write(edge_csv, 'utf-8', function () {
                            connection.resume();
                        });
                    });
                })
                .on('end', function () {
                    if(other_finished) {
                        edges.end();
                    } else {
                        other_finished = true;
                    }
                    nodes.end();
                });
        });
    });
}

// generate header file
tmp.file(function _tempFileCreated(err, path, fd, cleanupCallback) {
    if (err) throw err;

    var date = new Date();
    date = date.getFullYear() + "-" + ("0" + (date.getMonth() + 1)).slice(-2) + "-" + ("0" + date.getDate()).slice(-2);
    var data = '<?xml version="1.0" encoding="UTF-8"?><gexf xmlns="http://www.gexf.net/1.2draft" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.gexf.net/1.2draft http://www.gexf.net/1.2draft/gexf.xsd" version="1.2"><meta lastmodifieddate="' + date + '"><creator>ELGG2GEXF</creator><description>An ELGG network</description></meta><graph defaultedgetype="directed"><attributes class="node"><attribute id="0" title="type" type="string"/><attribute id="1" title="description" type="string"><default>No description available</default></attribute></attributes><attributes class="edge"><attribute id="0" title="type" type="string"/></attributes><nodes>';

    fs.writeFile(path, data, function(err, written, string) {
        if(err) throw err;

        status.header = path;
    });
});

// generate middle file
tmp.file(function _tempFileCreated(err, path, fd, cleanupCallback) {
    if (err) throw err;

    var data = '</nodes><edges>';

    fs.writeFile(path, data, function(err, written, string) {
        if(err) throw err;

        status.middle = path;
    });
});

// generate footer
tmp.file(function _tempFileCreated(err, path, fd, cleanupCallback) {
    if (err) throw err;

    var data = '</edges></graph></gexf>';

    fs.writeFile(path, data, function(err, written, string) {
        if(err) throw err;

        status.footer = path;
    });
});


// check if all files are generated and then combine them
function checkStatus() {
    var paths = [];
    for(s in status) {
        if(status[s] === false) {
            setTimeout(checkStatus, 500);
            return;
        } else {
            paths.push(status[s]);
        }
    }
    connection.end();
    csv_edges.end();
    csv_nodes.end();
    cat(paths, './elgg.gexf', function() {
        console.log("GEXF file generated. You can find it as elgg.gexf in the runtime directory");
    });
}
checkStatus();