/*
 * Tests for junitdiff
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
	optimist = require( 'optimist' ),
	colors = require( 'colors' ),

	junitdiff = require( '../junitdiff' );

function TestFailure( message ) {
	this.name = 'TestFailure';
	this.message = message;
}
TestFailure.prototype = Error.prototype;

function createNewDOM() {
	var newDOM = new DOMParser().parseFromString( '' );
	newDOM.appendChild( newDOM.createElement( 'testsuites' ) );
	return newDOM;
}

function createNewTestsuite( dom, name ) {
	var newTs = dom.createElement( 'testsuite' );
	newTs.setAttribute( 'name', name );
	return newTs;
}

function createNewTest( dom, name, time ) {
	var newTest = dom.createElement( 'testcase' );
	newTest.setAttribute( 'name', name );

	if ( time ) {
		newTest.setAttribute( 'time', time );
	}

	return newTest;
}

function createNewFailure( dom, type ) {
	var newFail = dom.createElement( 'failure' );
	newFail.setAttribute( 'type', type );
	return newFail;
}

var tests = [
	{
		title: 'Two empty DOMs',
		call: function () {
			var resultdom,
				dom1 = createNewDOM(),
				dom2 = createNewDOM();

			resultdom = junitdiff.compareDOMs( dom1, dom2 );

			resultdom = resultdom.getElementsByTagName( 'testsuites' )[0];

			if ( resultdom === null ) {
				throw new TestFailure( 'The testsuites element was not created.' );
			}
		}
	},

	{
		title: 'One suite, one test each, both passing',
		call: function () {
			var resultdom, testsuiteElement, testcaseElement,
				testname = 'passableTest',
				suitename = 'basicTests',
				dom1 = createNewDOM(),
				dom2 = createNewDOM(),
				ts = createNewTestsuite( dom1, suitename ),
				test = createNewTest( dom1, testname, 0.5 );

			ts.appendChild( test );
			dom1.firstChild.appendChild( ts );
			dom2.firstChild.appendChild( dom2.importNode( ts, true ) );

			resultdom = junitdiff.compareDOMs( dom1, dom2 );

			// Find the testsuite element and make sure it's correct
			testsuiteElement = resultdom.getElementsByTagName( 'testsuite' )[0];

			if ( !testsuiteElement ) {
				throw new TestFailure( 'The testsuite element was not created.' );
			}

			if ( testsuiteElement.getAttribute( 'name' ) !== suitename ) {
				throw new TestFailure( 'The testsuite element had the wrong name.' );
			}

			// Do the same thing for the actual testcase element
			testcaseElement = resultdom.getElementsByTagName( 'testcase' )[0];

			if ( !testcaseElement ) {
				throw new TestFailure( 'The testcase element was not created.' );
			}

			if ( testcaseElement.getAttribute( 'name' ) !== testname ) {
				throw new TestFailure( 'The testcase element had the wrong name.' );
			}
		}
	},

	{
		title: 'One suite, one test each, both failing',
		call: function () {
			var resultdom, testsuiteElement, testcaseElement, skippedElement,
				failtype = 'GenericFailureReason',
				testname = 'regressionTest',
				suitename = 'basicTests',
				dom1 = createNewDOM(),
				dom2 = createNewDOM(),
				ts = createNewTestsuite( dom1, suitename ),
				test = createNewTest( dom1, testname, 0.5 ),
				failure = createNewFailure( dom1, failtype );

			test.appendChild( failure );
			ts.appendChild( test );
			dom1.firstChild.appendChild( ts );
			dom2.firstChild.appendChild( dom2.importNode( ts, true ) );

			resultdom = junitdiff.compareDOMs( dom1, dom2 );

			// Find the testsuite element and make sure it's correct
			testsuiteElement = resultdom.getElementsByTagName( 'testsuite' )[0];

			if ( !testsuiteElement ) {
				throw new TestFailure( 'The testsuite element was not created.' );
			}

			if ( testsuiteElement.getAttribute( 'name' ) !== suitename ) {
				throw new TestFailure( 'The testsuite element had the wrong name.' );
			}

			// Do the same thing for the actual testcase element
			testcaseElement = resultdom.getElementsByTagName( 'testcase' )[0];

			if ( !testcaseElement ) {
				throw new TestFailure( 'The testcase element was not created.' );
			}

			if ( testcaseElement.getAttribute( 'name' ) !== testname ) {
				throw new TestFailure( 'The testcase element had the wrong name.' );
			}

			// Finally, check for the skipped element.
			skippedElement = resultdom.getElementsByTagName( 'skipped' )[0];

			if ( !skippedElement ) {
				throw new TestFailure( 'The test was not marked as a skip.' );
			}

			if ( skippedElement.getAttribute( 'type' ) !== failtype ) {
				throw new TestFailure( 'The test skip was of the wrong type.' );
			}
		}
	},

	{
		title: 'One suite, one test each, one passing, the other failing.',
		call: function () {
			var resultdom, testsuiteElement, testcaseElement, failureElement,
				failtype = 'GenericFailureReason',
				testname = 'regressionTest',
				suitename = 'basicTests',
				dom1 = createNewDOM(),
				dom2 = createNewDOM(),
				ts = createNewTestsuite( dom1, suitename ),
				test = createNewTest( dom1, testname, 0.5 ),
				failure = createNewFailure( dom2, failtype );

			ts.appendChild( test );
			dom1.firstChild.appendChild( ts );
			dom2.firstChild.appendChild( dom2.importNode( ts, true ) );
			dom2.getElementsByTagName( 'testcase' )[0].appendChild( failure );

			resultdom = junitdiff.compareDOMs( dom1, dom2 );

			// Find the testsuite element and make sure it's correct
			testsuiteElement = resultdom.getElementsByTagName( 'testsuite' )[0];

			if ( !testsuiteElement ) {
				throw new TestFailure( 'The testsuite element was not created.' );
			}

			if ( testsuiteElement.getAttribute( 'name' ) !== suitename ) {
				throw new TestFailure( 'The testsuite element had the wrong name.' );
			}

			// Do the same thing for the actual testcase element
			testcaseElement = resultdom.getElementsByTagName( 'testcase' )[0];

			if ( !testcaseElement ) {
				throw new TestFailure( 'The testcase element was not created.' );
			}

			if ( testcaseElement.getAttribute( 'name' ) !== testname ) {
				throw new TestFailure( 'The testcase element had the wrong name.' );
			}

			// Finally, check for the failure element.
			failureElement = resultdom.getElementsByTagName( 'failure' )[0];

			if ( !failureElement ) {
				throw new TestFailure( 'The test was not marked as a failure.' );
			}

			if ( failureElement.getAttribute( 'type' ) !== failtype ) {
				throw new TestFailure( 'The test failure was of the wrong type.' );
			}
		}
	}
];

var testIndex, failed, err,
	total = { failed: 0, passed: 0, all: 0 };

if ( require.main === module ) {
	for ( testIndex = 0; testIndex < tests.length; testIndex++ ) {
		test = tests[testIndex];

		failed = false;
		err = null;

		try {
			test.call();
		} catch ( e ) {
			failed = true;
			err = e;
		}

		total.all++;

		if ( failed ) {
			total.failed++;
			console.log( 'FAILED'.red + ': ' + test.title );
			console.log( err.stack || err.toString() );
		} else {
			total.passed++;
			console.log( 'PASSED'.green + ': ' + test.title );
		}
	}

	if ( total.failed > 0 ) {
		console.log( ( total.failed + ' tests failed' ).red );
	}

	if ( total.passed > 0 ) {
		console.log( ( total.passed + ' tests passed' ).green );
	}

	console.log( ( ( total.passed / total.all ) * 100 ) + ' percent pass rate' );
}
