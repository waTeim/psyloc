# Psyloc, a client side for psylo

# Usage

Initialization requires 3 parameters, *psyHost*, *apiHost*, and 
*website*.  
* *psyHost*: The hostname where to contact psylo.
* *apiHost*: The hostname where to contact the eSS api REST server.
* *website*: The hostname id of the eSS website.

    let psyloc = require('psyloc')(psyHost,apiHost,website);
