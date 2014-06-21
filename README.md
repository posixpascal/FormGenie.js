FormGenie.js
============

FormGenie is currently in _development_.
FormGenie follows a new way of validating your form. A hassle-free way ;).
How many times did you find yourself writing stupid form validation over and over again because most Validator-Libraries aren't compatible with your project?

The convenient way
------------------
FormGenie is highly customizable because that's what website forms usually are as well.
He knows about your input fields. Lets say you have the following form structure already built into your website:

	<form method="post" action="/my-server-validator.php">
		<label for="username">Enter a username</label>
		<input type="text" name="username">
		[..]
		<label for="password">Enter your password</label>
		<input type="text" name="password">
		[..]
		<label for="password_confirmation">Confirm your password</label>
		<input type="text" name="password_confirmation">
	</form>

FormGenie is able to tell which validation adapts for which input field based on the name, type or special classNames.
For example:

	<label for="password_confirmation">Confirm your password</label>
	<input type="text" name="password_confirmation">
	
Since this input field's name ends with _confirmation, FormGenie automatically associates this field with the corresponding *password* field.
No additional code needed. FormGenie is THAT simple.


Extandable through plugins
--------------------------
Sometimes your input fields need special care. In that case, just add a small plugin to FormGenie.
**Be aware! This plugin system is not yet finished and will be rewritten completely soon.**

*Example plugin code*
	// Just attach your function to FormGenie.addons.
	FormGenie.addons.CompanionAddon = function(fg_field, fg_form){

		// extend the FormGenie Field with usefull methods (this refers to the FGField here.)
	    fg_field.getCompanion = function(){
	        var field = this.getName();
	        if (/(.+)_confirmation/i.test(field)){
	            var companion = field.match(/(.+)_confirmation/i)[1];
	            var companionField = this.form.resolveTargetOne({ matcher: companion, attribute: "name"});
	            return companionField;
	        } else {
	        	// use this.form.debug instead of console.log to log fields
	            this.form.debug("Can't run getCompanion on: " + field);
	            return false;
	        }
	    };

	    // attach events to some form actions
	    fg_field.addEventListener('state:changed', function(){
	        if (/(.+)_confirmation/i.test(fg_field.getName())) {
	            var state = fg_field.getState();
	            var companion = fg_field.getCompanion();
	            companion.setState(state);
	        }
	    });
		
		// always return a array (you can optionally return `arguments` right now ;))
	    return [fg_field, fg_form]; // this part gets changed.
	};


Custom Validators
-----------------

Since addons itself just extend FormGenie in various ways, they can't however add validation rules to existing fields.
If you need a more validators for a input field you can add them using the following code:

	myForm = new FormGenie('customSelector');
	myForm.addValidator({
        "name": "ABC Validator",

        // any targets this validator should apply to
        "targets": [
        	// a matcher consist of 2 attributes: (matcher=a regex/string, attribute=the attribute to test against)
        	// You can add as many matchers as you wish. 
        	// The matchers are added with "OR" clauses. 
            { "matcher": /(.*)_abc/i, attribute: "name" }

            // you can also add 2 conditions:
            // this matches only input fields which match ALL matches
            /* { "matcher": /(.*)_abc/i, attribute: "name", andMatcher:
				{"matcher": "text", attribute: "type", andMatcher: 
					{
						
					}
				}
        	}*/ 
        ],
		
		// convention validators (like the _confirmation validator above) can be disabled with myForm.noConvention().
		// set this to true if myForm.noConvention() disables this validator as well
        "convention": true, 

		// This function gets executed on every field (which matches any targets)
		// do your validation logic here. Return true/false whether the form is valid/invalid
        "validator": function(field){
			return field.getValue().toLowerCase() == 'abc';
           
        },
		
		// save some logic by autoresolving any targets
		// This option is a bit tricky. If set to true, as soon as the validator loads
		// FormGenie will resolve all target 'matcher' to real input fields
		// Any input field added to the form will not be validated.
		// Set to false if you want to re-evaluate every form field.
        "autoresolve": true,
		
		// add middleware addons here.
        "addons": [
			// FormGenie.addons.isABCForm
        ],

        "companionField": {
            "receive_error": true
        }
    });



Integration with your selector engine
-------------------------------------

FormGenie is compatible with jQuery, Zepto, document.querySelectorAll, Sizzle and many other SelectorEngine.
By default, FormGenie checks if jQuery is loaded and falls back to document.querySelectorAll if not.
This really depends on your project. If you need support for older browsers, use jQuery as a selector engine.

To change the builtin selector engine, you can use:
	myForm = new FormGenie({selector: <yourSelectorFunc> })

	// or:
	myForm.setSelector(mySelectorFunc)

	/*
	Be aware!
	mySelectorFunc has to be a callable. It has to accept 2 arguments $([selector], [parent])
	The second argument should change the search scope of the selector
	If thats not the case, you have to write a proxyFunction like this:


	mySelector = function(selector, scope){
		return MyRealSelector(selector).fromScope(scope);
	}
	 */	}
	


This readme was written in 2min by a non-native speaker. Please forgive.
