# psyloc: a client side for psylo

# Usage

Initialization requires 3 parameters, *psyHost*, *apiHost*, and 
*website*.  
* *psyHost*: The hostname where to contact psylo.
* *apiHost*: The hostname where to contact the eSS api REST server.
* *website*: The hostname id of the eSS website.

Then require psyloc with those parameters.

    let psyloc = require('psyloc')(psyHost,apiHost,website);

# Example

    let psyloc = require('localhost','api-dev.esecuresend.com','dev.esecuresend.com');
