/* 
 * @Author: administrator
 * @Date:   2014-06-20 14:26:14
 * @Last Modified 2014-06-20
 */

// Object.keys stub
var getKeys = function(obj){
    var keys = [];
    for(var key in obj){
        keys.push(key);
    }
    return keys;
}

// A small wrapper for form errors
var FGError = function(validator, inputField){
    this.validator = validator;
    this.inputField = inputField;

    this.resolve = function(){
        this.inputField.setState(false);
    }



    return this;

}
// A small wrapper arround input elements
var FGInput = function(input, form){
    this.form = form;
    this.input = input;

    this.getName = function(){
        return this.input.name;
    };

    this.getValue = function(){
        if (this.input.type == "checkbox" || this.input.type == "radio"){
            return (this.input.checked);
        }
        return this.input.value;
    }
    this.isChecked = function(){
        return this.getValue();
    }
    this.setValue = function(value){
        this.input.value = value;
    }

    this.setState = function(state){
        if (state == "invalid" || state === false){
            this.input.classList.remove('fg-input-valid');
            this.input.classList.add('fg-input-invalid');
        } else if (state == "valid" || state === true) {
            this.input.classList.remove('fg-input-invalid');
            this.input.classList.add('fg-input-valid');
        } else {
            this.input.classList.remove('fg-input-invalid');
            this.input.classList.remove('fg-input-valid');
        }

        this.dispatchEvent(new Event('state:changed'));
    }

    this.getState = function(){
        var isValid = (this.input.classList.contains("fg-input-valid"));
        var isInvalid = (this.input.classList.contains("fg-input-invalid"));

        if (isValid || isInvalid){ return (isValid); }
        return null;
    }



    this.dispatchEvent = function(event, conf){
        this.input.dispatchEvent(event, conf);
    }

    this.addEventListener = function(listener, cb, conf){
        this.input.addEventListener(listener, cb, conf);
    }

    return this;
};

/**
 * FormGenie's base class.
 * @param {String} scope A string containing the restricted object.
 */
var FormGenie = function(form, customSelectorEngine) {
    this.$ = customSelectorEngine || jQuery || document.querySelectorAll;
    this.DEBUG = true;
    this.form = this.$(form).toArray();

    if ( Object.prototype.toString.call( this.form ) === '[object Array]' ){
        this.form = this.form[0];
    }

    this.validators = [];

    if (this.$(this.form).length == 0)
        this.debug("No suitable form found");

    this.validate = function(event) {
        result = this.runAllValidations();
        if (this._allTrueOrFalse(result)){
            return true;
        }
        for (var i = 0, len = this.errors.length; i < len; i++){
            var error = this.errors[i];
            error.resolve();
        }
        event.stopPropagation();
        event.preventDefault();
        return false;
    };
    // attach submit events
    this.form.addEventListener("submit", this.validate.bind(this), true);

    return this;
};
FormGenie.addons = {};

FormGenie.prototype.getInputFields = function(){
    return this.$("input", this.form);
};
FormGenie.prototype.runAllValidations = function(){
    this.errors = [];
    return this._iterate(this.validators, this.runValidator.bind(this));
};

FormGenie.prototype.validatorProxy = function(validator){
    var fg = this;
    return function(field){
        field.setState(null);
        var result = validator.validator(field);
        if (!result){
            fg.errors.push(new FGError(validator, field));
        } else {
            field.setState(true);
        }
        return result;
    }
}
FormGenie.prototype.runValidator = function(validator){
    if (!validator.resolved){
        validator.targets = this.resolveTargets(validator, this.form);
        validator.resolved = true;
        validator.resolved_at = new Date();
    }
    var targets = validator.targets;
    var validator = this.validatorProxy(validator);
    var results = this._iterate(targets, validator);
    return this._allTrueOrFalse(results);
};

FormGenie.prototype._allTrueOrFalse = function(array){
    for (var i = 0, len = array.length; i < len; i++){
        if (!array[i]){
            return false;
        }
    }
    return true;
}

// TODO: implement this. ;)
FormGenie.prototype.isValidValidator = function(validator){
    return true;
}

FormGenie.prototype.debug = function(msg){
    if (this.DEBUG){
        console.log(msg);
    }
};

FormGenie.prototype.addonInjection = function(inputField, rootForm){
    var addons = getKeys(FormGenie.addons);
    for (var i = 0, len = addons.length; i < len; i++){
        var addon = FormGenie.addons[addons[i]];
        var result = addon(inputField, rootForm);

        inputField = result[0];
        rootForm = result[1];
    }
    return [inputField, rootForm];
}
FormGenie.prototype.resolveTargetOne = function(target){
    return this.resolveTarget(target)[0];
}

FormGenie.prototype.resolveChain = function(matcher, fginput){
    var r = this.resolveTarget(matcher);
    if (r.indexOf(fginput) >= 0){ return r; }
    return undefined;
}

FormGenie.prototype.resolveTarget = function(target){
    var matcher = target.matcher;
    var attribute = target.attribute;
    var isRegexTest = (matcher instanceof RegExp);
    var root = this;
    var inputFields = this.getInputFields();
    targets = this._iterate(inputFields, function(inputField){
        var fginput = undefined;
        if (isRegexTest){
            // regex matcher
            // load addon middleware
            if (matcher.test(inputField[attribute])){
                fginput = new FGInput(inputField, root);
            }
        } else {
            // check if attribute matches matcher
            if (inputField[attribute] == matcher){
                fginput = new FGInput(inputField, root);
            }
        }
        if (typeof target.andMatcher !== "undefined") {
            fginput = root.resolveChain(target.andMatcher, fginput);

        }
        if (typeof fginput === "undefined"){
            return undefined;
        }

        var result = root.addonInjection.call(root, fginput, root.form);
        fginput = result[0];
        root.form = result[1];

        return fginput;
    });

    return targets;

};

FormGenie.prototype.resolveTargets = function(validator, form){
   var validatorTargets = validator.targets;
   var targets = this._iterate(validatorTargets, this.resolveTarget.bind(this))[0];

   return targets;
};

/**
 * validator is a object containing the following attributes:
 *   - name: A name for the validator
 *   - autoresolve: Set to false if you want the validatorTargets be evaluated every time the user clicks on submit (default: true)
 *   - targets: An array containing objects which match a field
 *      - matcher: A regex or selector to match a form field
 *      - attribute: A attribute for matching with regexes. supported: name, class, id, type, value
 *   - convention: true/false (is this a convention-validator? eg. based on field name/type)
 *   - validator: function
 *      - This function gets the field object (input). This is the place where validation logic goes in.
 *      - this function also receives the form and any companionField
 * @param validator     A object
 * @returns {boolean}   True if the validator was added successfully.
 */
FormGenie.prototype.addValidator = function(validator){
   if (validator.autoresolve) {
       validator.targets = this.resolveTargets(validator, this.form);
       validator.resolved = true;
       validator.resolved_at = new Date();
   }

   if (this.isValidValidator(validator)) {
       this.validators.push(validator);
       return true;
   } else {
       this.debug("Validator " + validator.name + " is invalid. Check the docs on how to build your own validator");
       return false;
   }

};

FormGenie.prototype.addConventionValidators = function(){
    // add _confirmation validator
    this.addValidator({
        "name": "Confirmation Validator",
        "targets": [
            { "matcher": /(.*)_confirmation/i, attribute: "name" }
        ],
        "convention": true,
        "validator": function(field){
           var companion = field.getCompanion();
           return (companion.getValue() == field.getValue());
        },

        "autoresolve": true,

        "addons": [
           FormGenie.addons.CompanionAddon
        ],

        "companionField": {
            "receive_error": true
        }
    });



    this.addValidator({
        "name": "AcceptTOS Validator",
        "targets": [
            { "matcher": /checkbox/i, attribute: "type", andMatcher: {
                matcher: /(terms|tos|terms_of_service|terms_of_usage|agb|privacy_agreement)/i, attribute: "name"
            }}
        ],
        "autoresolve": true,
        "validator": function(checkbox){
            return checkbox.isChecked();
        },
        "addons": []
    });


    this.addValidator({
        "name": "E-Mail Validator",
        "targets": [
            { "matcher": /email/i, attribute: "name"},
            { "matcher": /email/i, attribute: "type"}
        ],
        "autoresolve": true,
        "validator": function(field){
            // this is just a basic email validator.
            return /\S+@\S+\.\S+/.test(field.getValue());

        },
        "addons": []
    });


};

FormGenie.prototype.magicForm = function(){
    this.addConventionValidators();
};

FormGenie.prototype._iterate = function(array, iterator, include_undefined){
    include_undefined = include_undefined || false;
    var results = [];
    var result;
    for (var i = 0, len = array.length; i < len; i++){
        result = iterator(array[i]);
        if (typeof result !== "undefined" || include_undefined){
            results.push(result);
        }

    }
    return results;
}

window.FormGenie = FormGenie;

/* this is an example of plugin injection. */

/**
 * Add .getCompanion method which gets related input fields (password, password_confirmation)
 * @param fg_field FormGenie Input Class
 * @param fg_form FormGenie Form Class
 * @returns {*[]} Array containing modified input & form classes2
 */
FormGenie.addons.CompanionAddon = function(fg_field, fg_form){
    fg_field.getCompanion = function(){
        var field = this.getName();
        if (/(.+)_confirmation/i.test(field)){
            var companion = field.match(/(.+)_confirmation/i)[1];
            var companionField = this.form.resolveTargetOne({ matcher: companion, attribute: "name"});
            return companionField;
        } else {
            this.form.debug("Can't run getCompanion on: " + field);
            return false;
        }
    };
    window.fg = fg_field;
    // share state with companion
    fg_field.addEventListener('state:changed', function(){
        if (/(.+)_confirmation/i.test(fg_field.getName())) {
            var state = fg_field.getState();
            var companion = fg_field.getCompanion();
            companion.setState(state);
        }
    });

    return [fg_field, fg_form];
};