# ELGG Graph Export
Author: Karl Johann Schubert <mail@kjschubert.de>

License: CC BY-SA 4.0

## Functionality
This script will export your elgg database into an .gexf file as well as two .csv files - one for the nodes and the second one for the edges.

The following database entries will be exported as nodes:
- All ElggEntities (sites, users, groups, objects) from the table entities
- All ElggEntities which are only found in the system_log table
- All Metadata objects from the table metadata
- All Metadata objects which are only found in the system log
- All Annotations from the table annotations
- All Annotations which are only found in the system log
- All Access Collections

The following database entries will be exported as edges:
- All Relationships from the table entity_relationships, Edge Label is the attribute relationship
- The ElggEntities attributes site_guid (in_site), owner_guid (owns), container_guid (contains), access_id (is accessable)
- All events (except for relationships) from the system log, Edge Label is the attribute event
- For Metadata: has_metadata, owns_metadata
- For Annotations: has_annotation, owns_annotation
- For Access Collections own_access and in_site

## Working with Gephi
Gephi doesn't support parallel edges with different labels and will merge these edges. When importing the Graph you can choose how to merge the weight (sum, min, max, average).

Gephi will label the merged edge with the label of the edge with occured first.

To avoid the loss of information you can use the .csv files. Import the file elgg_nodes.csv as Nodes File and the file elgg_edges.csv as Edges File. The file with edges contains another column which is called relation. Gephi will import this column and thereby not merge parallel edges. You can then filter the edges you need in Gephi, or you postprocess the .csv files before importing them to Gephi.

## Usage
### Installation
- make sure you have node.js and npm installed
- clone the git repository and change into it
```
git clone https://github.com/kjschubert/ELGG-Graph-Export.git
cd ELGG2GEXF
```
- copy the example config file and edit it
```
cp config.example.js config.js
nano config.js
```
- enter your database settings and a list of events from the system log to skip (ELGG fires :before and :after events for some events and in most cases you don't need the export them)
- install the dependencies with npm: `npm install`
- run the script with: `node index.js`
- ATTENTION: better don't run the script on your production server, especially not when users want to work there, your database might experience "some" load :)

### Configuration
The configuration file should be self explanatory at the moment.
The key 'skip_events' can be used to skip some events from the system log. This is useful because for some events ELGG fires additionally an :before and/or an :after event.

## Postprocessing
At the moment the script is only generating a master graph. Before importing the data to different software for postprocessing and analysis you may want to filter it with awk.

### Filter Nodes
The following command is writing all nodes of the type 'user' or 'group' to processed_nodes.csv
```
awk -F';' '$3 ~ /user|group/ {print}' elgg_nodes.csv > processed_nodes.csv
```
- `-F';'` is defining the semicolon as delimiter
- `$3 ~ /user|group/` tests column 3 (`$3`) for expression `/user|group/`

The Nodes file has the following columns
 1. id
 2. label
 3. type
 4. description

### Filter Edges
The following command is writing all edges of the relation 'active_plugin' processed_edges.csv
```
awk -F';' '$7 ~ /active_plugin/ {print}' elgg_edges.csv > processed_edges.csv
```
- `-F';'` is defining the semicolon as delimiter
- `$7 ~ /active_plugin/` tests column 7 (`$7`) for expression `/active_plugin/`

The Edges file has the following columns
 1. id
 2. source
 3. target
 4. type
 5. label
 6. weight
 7. relation