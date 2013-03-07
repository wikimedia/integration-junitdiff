/*
 * junitdiff
 *
 * Diff two JUnit files and return a JUnit output that tells you about newly-
 * failing tests.
 *
 * Intended originally for use with the Parsoid project.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var xml = require( 'xmldom' ),
	DOMParser = xml.DOMParser,
	XMLSerializer = xml.XMLSerializer,
	fs = require( 'fs' ),
	optimist = require( 'optimist' );

function TestsAreGoneError( message ) {
	this.name = 'TestsAreGoneError';
	this.message = message;
}
TestsAreGoneError.prototype = Error.prototype;

function findFirstNode( node, name ) {
	if ( node.nodeType === node.ELEMENT_NODE &&
			node.nodeName.toLowerCase() === name ) {
		return node;
	} else {
		return node.getElementsByTagName( name )[0];
	}
}

function traverse( nodeName, child, results ) {
	var thingName,
		newChild = child[1],
		shouldCompare = true,
		compareFunc = compare[nodeName] || function () {};

	while ( child[0] !== null && (
				child[0].nodeType !== child[0].ELEMENT_NODE ||
				child[0].nodeName.toLowerCase() !== nodeName ) ) {
		child[0] = child[0].nextSibling;
	}

	if ( child[0] === null ) {
		// We couldn't find a testsuite. Don't report changes, just skips.
		shouldCompare = false;
	} else {
		thingName = child[0].getAttribute( 'name' );
	}

	while ( newChild !== null && (
				newChild.nodeType !== newChild.ELEMENT_NODE ||
				newChild.nodeName.toLowerCase() !== nodeName || (
					shouldCompare &&
					newChild.getAttribute( 'name' ) !== thingName ) ) ) {
		newChild = newChild.nextSibling;
	}

	if ( newChild === null ) {
		// Well, the tests are gone.
		if ( child[0] === null ) {
			// Oh, there never were any tests. Cool.
		} else {
			// The tests disappeared. Well, inform the world.
			throw new TestsAreGoneError( 'The tests....are gone!' );
		}
	} else if ( thingName ) {
		results[thingName] = compareFunc( [ child[0], newChild ], shouldCompare );

		if ( child[0] !== null ) {
			child[0] = child[0].nextSibling;
		}
	}
}

function buildXMLResult( result ) {
	var i, j, listOfTests, suiteName, suite,
		testName, testObj, test,
		xmldoc = new DOMParser().parseFromString( '<testsuites></testsuites>' ),
		testsuites = findFirstNode( xmldoc, 'testsuites' ),
		listOfSuites = Object.keys( result );

	function testsuite() {
			return xmldoc.createElement( 'testsuite' );
	}

	function testcase() {
		return xmldoc.createElement( 'testcase' );
	}

	function failure() {
		return xmldoc.createElement( 'failure' );
	}

	function skipped () {
		return xmldoc.createElement( 'skipped' );
	}

	for ( i = 0; i < listOfSuites.length; i++ ) {
		suiteName = listOfSuites[i];
		suite = testsuite();
		suite.setAttribute( 'name', suiteName );

		listOfTests = Object.keys( result[suiteName] );
		for ( j = 0; j < listOfTests.length; j++ ) {
			testName = listOfTests[j];
			testObj = result[suiteName][testName];
			test = testcase();
			test.setAttribute( 'name', testName );
			test.setAttribute( 'time', testObj.time );

			if ( testObj.failure ) {
				test.appendChild( testObj.node.getElementsByTagName( 'failure' )[0] );
			} else if ( testObj.skipped ) {
				failNode = testObj.node.getElementsByTagName( 'failure' )[0];
				skipNode = skipped();
				test.appendChild( skipNode );

				for ( k = 0; k < failNode.attributes.length; k++ ) {
					skipNode.setAttribute( failNode.attributes[k].name, failNode.attributes[k].value );
				}

				failNode = failNode.firstChild;
				while ( failNode !== null ) {
					skipNode.appendChild( failNode );
					failNode = failNode.nextSibling;
				}
			}

			suite.appendChild( test );
		}

		testsuites.appendChild( suite );
	}

	return xmldoc;
}

var compare = {
	testsuites: function ( node ) {
		var hasRun = false,
			results = {},
			child = [ node[0].firstChild, node[1].firstChild ],
			traverseFunc = traverse.bind( null, 'testsuite' );

		while ( child[0] !== null ) {
			try {
				traverseFunc( child, results );
			} catch ( e ) {
				if ( e instanceof TestsAreGoneError ) {
					if ( !hasRun ) {
						throw e;
					}
				} else {
					throw e;
				}
			}

			hasRun = true;
		}

		return results;
	},

	testsuite: function ( node, shouldCompare ) {
		var hasRun = false,
			results = {},
			child = [
				( node[0] || { firstChild: null } ).firstChild,
				( node[1] || { firstChild: null } ).firstChild ],
			traverseFunc = traverse.bind( null, 'testcase' );

		while ( child[0] !== null ) {
			try {
				traverseFunc( child, results );
			} catch ( e ) {
				if ( e instanceof TestsAreGoneError ) {
					if ( !hasRun ) {
						throw e;
					}
				} else {
					throw e;
				}
			}

			hasRun = true;
		}

		return results;
	},

	testcase: function ( node, shouldCompare ) {
		var results = {};

		results.time = node[1].getAttribute( 'time' );
		if ( shouldCompare ) {
			if ( node[0].getElementsByTagName( 'failure' ).length === 0 ) {
				if ( node[1].getElementsByTagName( 'failure' ).length === 0 ) {
					results.failure = false;
					results.skipped = false;
				} else {
					results.failure = true;
					results.skipped = false;
					results.node = node[1];
				}
			} else {
				if ( node[1].getElementsByTagName( 'failure' ).length === 0 ) {
					results.failure = false;
					results.skipped = false;
				} else {
					results.failure = false;
					results.skipped = true;
					results.node = node[1];
				}
			}
		} else {
			if ( node[1].getElementsByTagName( 'failure' ).length === 0 ) {
				results.failure = false;
				results.skipped = false;
			} else {
				results.failure = false;
				results.skipped = true;
			}

			results.node = node[1];
		}

		return results;
	}
};

function runMain() {
	// Not doing any checking or options yet, but will do in the future.
	var argv = optimist.usage( 'Usage: $0 [options] <test-file-0> <test-file-1>', {
		} )
		.check( function ( argv ) {
		} )
		.argv,

		testDoc = [
			new DOMParser().parseFromString( fs.readFileSync( argv._[0], 'UTF-8' ) ),
			new DOMParser().parseFromString( fs.readFileSync( argv._[1], 'UTF-8' ) )
		];

	console.log(
		new XMLSerializer().serializeToString(
			compareDOMs( testDoc[0], testDoc[1] )
		)
	);
}

function compareDOMs( dom1, dom2 ) {
	var i, res, curTestDoc,
		testDoc = [ dom1, dom2 ];

	for ( i = 0; i < testDoc.length; i++ ) {
		curTestDoc = testDoc[i];
		testDoc[i] = findFirstNode( curTestDoc, 'testsuites' );
	}

	res = compare.testsuites( testDoc );
	return buildXMLResult( res );
}

if ( module instanceof Object ) {
	module.exports.compareDOMs = compareDOMs;
	module.exports.TestsAreGoneError = TestsAreGoneError;
}

if ( require.main === module ) {
	runMain();
}
