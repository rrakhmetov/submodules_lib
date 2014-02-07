/*
Copyright 2012 - $Date $ by PeopleWare n.v.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

define([],
  function() {

    function typeOf(obj) {
      // summary:
      //   A better type then Object.toString() or typeof.
      // description:
      //      toType(undefined); //"undefined"
      //      toType(new); //"null"
      //      toType({a: 4}); //"object"
      //      toType([1, 2, 3]); //"array"
      //      (function() {console.log(toType(arguments))})(); //arguments
      //      toType(new ReferenceError); //"error"
      //      toType(new Date); //"date"
      //      toType(/a-z/); //"regexp"
      //      toType(Math); //"math"
      //      toType(JSON); //"json"
      //      toType(new Number(4)); //"number"
      //      toType(new String("abc")); //"string"
      //      toType(new Boolean(true)); //"boolean"

      /* based on
       http://javascriptweblog.wordpress.com/2011/08/08/fixing-the-javascript-typeof-operator/
       */

      if (obj === null) {
        // workaround for eopdf; it seems that js.typeOf(null) is returned by eopdf as "domwindow"
        return "null";
      }
      var result = Object.prototype.toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
      // on some browsers, the main window returns as "global" (WebKit) or "window" (FF), but this is an object too
      if (result === "global" || result == "window") {
        result = "object";
      }
      return result; // return String
    }

    function getPrototypeChain(/*Object*/ obj) {
      // summary:
      //   Returns an array where result[i] is the prototype
      //   of result[i-1], with obj === result[0]. result[length]
      //   is thus Object.prototype.

      function recursive(acc, o) {
        if (!o) {
          return acc;
        }
        else {
          acc.push(o);
          return recursive(acc, Object.getPrototypeOf(o));
        }
      }

      return recursive([], obj);
    }

    function getAllKeys(/*Object*/ obj) {
      // summary:
      //   Returns an array containing the names of all given objects enumerable properties.
      //   Like keys, but for the entire prototype chain. The array starts with the properties
      //   of Object.prototype, and works down the chain.

      return getPrototypeChain(obj).reduceRight(
        function(acc, proto) {
          return nub(acc.concat(Object.keys(proto)));
        },
        []
      );
    }

    function isInt(/*Number*/ n) {
      // summary:
      //   True if n is an integer.
      //   n must be a number.

      return n % 1 === 0;
    }

    function nub(/*Array*/ array, /*Boolean?*/ removeNull) {
      // summary:
      //   Returns an array that has all the elements of `array`, in order, but with later duplicates removed.
      //   If `removeNull` is given and thruthy, nulls and undefineds are removed too.

      if (!array) {
        return array;
      }
      var result = array.reduce(
        function(acc, el) {
          if ((!removeNull || el) && acc.indexOf(el) < 0) {
            acc.push(el);
          }
          return acc;
        },
        []
      );
      return result;
    }

    function substitute(/*String*/ str, /*Object*/ context) {
      // summary:
      //  All occurrences of "${...}$" in `str` are replaced by the result of the
      //  execution of what is between the curly brackets as JavaScript, with `context`
      //  as `this`.

      //   Like dojo/string.substitute, but evals full code.
      //   No formatting (yet).
      return str.replace( // return String
        /\$\{(.+?)\}\$/gm,
        function(match, pattern) {
          var value;
          try {
            var executor = new Function("return (" + pattern + ");");
            value = executor.call(context);
          }
          catch (err) {
            logger.error("Executing pattern substitution of ${" + pattern + "}$ in '" + str + "' with context " + context, err);
            return "?? ${" + pattern  + "}$ -- " + (err.message || err) + " ??";
          }
          return value || value === "" ? value.toString() : "?" + pattern  + "?";
        }
      );
    }

    function sortComparable(/*Object*/ c1, /*Object*/ c2) {
      // summary:
      //   A sort function for objects that have a compare function.
      //   undefined < null < the compare function of the objects

      return c1 === undefined ? (
               c2 === undefined ? 0 : -1
             )
             : (
               c1 === null ? (
                 c2 === undefined ?
                   +1 :
                   c2 === null ? 0 : -1
               )
               : (
                 !c2 ? +1 : c1.compare(c2)
               )
             );
    }

    function sortReversed(/*Function*/ sort) {
      // summary:
      //   Produces a compare function that does the reverse sort defined by sort.

      return function(o1, o2) {
        return -sort(o1, o2);
      }
    }

    function sortVersionNumbers(/*Array*/ arrayToSort) {
      /**
       * Compares two software version numbers (e.g. "1.7.1" or "1.2b").
       *
       * This function was born in http://stackoverflow.com/a/6832721.
       *
       * @param {string} v1 The first version to be compared.
       * @param {string} v2 The second version to be compared.
       * @param {object} [options] Optional flags that affect comparison behavior:
       * <ul>
       *     <li>
       *         <tt>lexicographical: true</tt> compares each part of the version strings lexicographically instead of
       *         naturally; this allows suffixes such as "b" or "dev" but will cause "1.10" to be considered smaller than
       *         "1.2".
       *     </li>
       *     <li>
       *         <tt>zeroExtend: true</tt> changes the result if one version string has less parts than the other. In
       *         this case the shorter string will be padded with "zero" parts instead of being considered smaller.
       *     </li>
       * </ul>
       * @returns {number|NaN}
       * <ul>
       *    <li>0 if the versions are equal</li>
       *    <li>a negative integer iff v1 < v2</li>
       *    <li>a positive integer iff v1 > v2</li>
       *    <li>NaN if either version string is in the wrong format</li>
       * </ul>
       *
       * @copyright by Jon Papaioannou (["john", "papaioannou"].join(".") + "@gmail.com")
       * @license This function is in the public domain. Do what you want with it, no strings attached.
       */
      arrayToSort.sort(function(/*String*/ v1, /*String*/ v2, /*Object*/ options) {
        var lexicographical = options && options.lexicographical,
          zeroExtend = options && options.zeroExtend,
          v1parts = v1.split('.'),
          v2parts = v2.split('.');

        function isValidPart(x) {
          return (lexicographical ? /^\d+[A-Za-z]*$/ : /^\d+$/).test(x);
        }

        if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) {
          return NaN;
        }

        if (zeroExtend) {
          while (v1parts.length < v2parts.length) v1parts.push("0");
          while (v2parts.length < v1parts.length) v2parts.push("0");
        }

        if (!lexicographical) {
          v1parts = v1parts.map(Number);
          v2parts = v2parts.map(Number);
        }

        for (var i = 0; i < v1parts.length; ++i) {
          if (v2parts.length == i) {
            return 1;
          }

          if (v1parts[i] == v2parts[i]) {
            // continue; go to next loop cycle
          }
          else if (v1parts[i] > v2parts[i]) {
            return 1;
          }
          else {
            return -1;
          }
        }

        if (v1parts.length != v2parts.length) {
          return -1;
        }

        return 0;
      });
    }

    function string2CharCode(str) {
      // summary:
      //   Transform a string into an array of CharCodes.

      return str.split("").map(function(c) {return c.charCodeAt(0);});
    }

    function charCode2String(charCodes) {
      // summary:
      //   Transform an array of CharCodes into a String.

      return charCodes.map(function(charCode) {return String.fromCharCode(charCode);}).join("");
    }

    var MAX_INT = 9007199254740992;
    var MIN_INT = -9007199254740992;

    // From https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/random
    // Returns a random integer between min and max
    // Using Math.round() will give you a non-uniform distribution!
    function randomInt(min, max) {
      if (!max && max !== 0) {
        max = MAX_INT;
      }
      if (!min && min !== 0) {
        min = MIN_INT;
      }
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function randomInts(min, max, nr) {
      var result = [];
      var r = undefined;
      for (var i = 0; i < nr; i++) {
        while (!r || result.some(function(earlierR) {//noinspection JSReferencingMutableVariableFromClosure
          return r === earlierR;})) {
          r = randomInt(min, max);
        }
        result[i] = r;
        r = undefined;
      }
      return result;
    }

    function haveSameElements(a1, a2) {
      // summary:
      //   Returns true if array a1 and array a2 have the samen elements, irrespective of their order.
      //   Duplicates are allowed.

      return a1.every(function(a1i) {return a2.indexOf(a1i) >= 0;}) &&
        a2.every(function(a2i) {return a1.indexOf(a2i) >= 0;});
    }

    function flatten(/*Array*/ arr) {
      return arr.reduce(
        function(acc, el) {
          if (typeOf(el) === "array") {
            return acc.concat(flatten(el));
          }
          else {
            acc.push(el);
            return acc;
          }
        },
        []
      );
    }

    var js = {
      // summary:
      //   Methods to aid with the JavaScript language.
      typeOf: typeOf,
      getPrototypeChain: getPrototypeChain,
      getAllKeys: getAllKeys,
      isInt: isInt,
      nub: nub,
      flatten: flatten,
      substitute: substitute,
      sortComparable: sortComparable,
      sortReversed: sortReversed,
      sortVersionNumbers: sortVersionNumbers,
      string2CharCode: string2CharCode,
      charCode2String: charCode2String,
      MAX_INT: MAX_INT,
      MIN_INT: MIN_INT,
      randomInt: randomInt,
      randomInts: randomInts,
      haveSameElements: haveSameElements
    };

    return js;
  }
);
