/* 
 * @Author: administrator
 * @Date:   2014-06-20 14:26:14
 * @Last Modified 2014-06-27
 */

// TODO: don't pollute the global namespace with this stuff...
var FGSettings = {
    fields: {
        optionalClass: "fg-optional",
        exclude: [{
            matcher: "submit",
            attribute: "type"
        }], // by default - do not validate any submit input
        noEvents: false // disable all events from formfields
    },

    validator: {
        runAtSubmit: true,
        runAtFieldChange: false
    },

    form: {
        useAjax: false, // set to true if you want FormGenie to send your form using ajax
        // this is disabled by default for people using turbolinks/pjax and others.

        showErrors: true // formGenie can show errors ontop of the form. if you don't want this
        // you can disable it here.
    }
};
// Object.keys stub
var getKeys = function(obj) {
    var keys = [];
    for (var key in obj) {
        keys.push(key);
    }
    return keys;
};

// A small wrapper for grouped fields (I wanted to implement this for CompanionAddon as well.)
var FGGroup = function() {
    this.fields = [];

    this.add = function(field) {
        if (this.fields.indexOf(field) == -1) this.fields.push(field);
    };

    this.get = function(fieldName) {
        for (var i = 0, len = this.fields.length; i < len; i++) {
            if (this.fields[i].getName() == fieldName) {
                return this.fields[i];
            }
        }
    };

    this.remove = function(field) {
        var i = this.fields.indexOf(field);
        if (field >= 0) {
            this.fields[i] = null;
        }
        this._nilFields();
        return field;
    };

    // strip any null values from array
    this._nilFields = function() {
        var c = [];
        for (var i = 0, len = this.fields.length; i < len; i++) {
            var field = this.fields[i];
            if (field) c.push(field);
        }
        this.fields = c;
        if (len > this.fields.length) return true;
        return false;
    };
};

// A small wrapper for form errors
var FGError = function(validator, inputField) {
    this.validator = validator;
    this.inputField = inputField;

    this.resolve = function() {
        this.inputField.setState(false);
        if (typeof this.validator.error !== "undefined") {
            this.validator.error(inputField);
        }
    };

    return this;

};
// A small wrapper arround input elements
var FGInput = function(input, form) {
    this.form = form;
    this.input = input;
    this.validators = []; // attached validators

    // Add EventHandling to input fields
    this.input.addEventListener('change', this.changeEvent, false);
    this.input.addEventListener('blur', this.blurEvent, false);

    this.getName = function() {
        return this.input.name;
    };

    this.getValue = function() {
        if (this.input.type == "checkbox" || this.input.type == "radio") {
            return (this.input.checked);
        }
        return this.input.value;
    };

    this.getAttribute = function(n, dataflag) {
        if (dataflag) {
            return this.getDataAttribute(n);
        }
        return this.input.getAttribute(n);
    };
    this.getDataAttribute = function(attr, fallback) {
        attr = this.input.dataset[attr];

        if (typeof attr === "undefined") {
            attr = fallback;
        }
        return attr;
    };
    this.isChecked = function() {
        return this.getValue();
    };
    this.setValue = function(value) {
        this.input.value = value;
    };



    this.setState = function(state) {
        if (state == "invalid" || state === false) {
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
    };

    this.getState = function() {
        var isValid = (this.input.classList.contains("fg-input-valid"));
        var isInvalid = (this.input.classList.contains("fg-input-invalid"));

        if (isValid || isInvalid) {
            return (isValid);
        }
        return null;
    };


    this.getFGClass = function() {
        switch (this.input.type.toLowerCase()) {
            case "checkbox":
                e = FormGenie.CHECKBOX;
                break;
            case "radio":
                e = FormGenie.RADIO;
                break;
            default:
                e = FormGenie.UNKNOWN;
                break;
        }
        return e;
    };


    this.dispatchEvent = function(event, conf) {
        this.input.dispatchEvent(event, conf);
    };

    this.addEventListener = function(listener, cb, conf) {
        this.input.addEventListener(listener, cb, conf);
    };

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

    if (Object.prototype.toString.call(this.form) === '[object Array]') {
        this.form = this.form[0];
    }

    this.validators = [];

    if (this.$(this.form).length === 0)
        this.debug("No suitable form found");

    this.validate = function(event) {
        result = this.runAllValidations();
        if (this._allTrueOrFalse(result)) {
            if (this.DEBUG) {
                alert("[FormGenie]: Form validated. I would submit your form now but I'm running with DEBUG set to true.\n\nNow is a good point to disable DEBUG mode :)");
                event.stopPropagation();
                event.preventDefault();
                return false;
            }
            return true;
        }
        for (var i = 0, len = this.errors.length; i < len; i++) {
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
FormGenie.COMPARER_REGEX = 1; // use regex for matching
FormGenie.COMPARER_IN = 2; // is Matcher<> in Attribute(array)
FormGenie.COMPARER_EQUAL = 3; // true equal match
FormGenie.COMPARER_DATE = 4;
FormGenie.COMPARER_LT = 5; // less than
FormGenie.COMPARER_GT = 6; // greater than


// Virtual Classes:
FormGenie.CHECKBOX = "CheckboxField";
FormGenie.RADIO = "RadioField";

/**
 * Inverts the matcher property. This is just syntax sugar.
 * The only thing it'll add is inverse:true to the matcher object
 * @param matcher
 */
FormGenie.not = function(matcher) {
    matcher.inverse = true;
    return matcher;
};


FormGenie.prototype.getInputFields = function(includeSubmitField) {
    if (typeof includeSubmitField === "undefined") {
        includeSubmitField = false;
    }

    var inputs = this.$("input", this.form);
    var result = [];

    if (!includeSubmitField) {
        for (var i = 0, len = inputs.length; i < len; i++) {
            if (inputs[i].type.toLowerCase() !== "submit") {
                result.push(inputs[i]);
            }
        }
    } else {
        result = inputs;
    }

    return result;
};
FormGenie.prototype.runAllValidations = function() {
    this.errors = [];
    return this._iterate(this.validators, this.runValidator.bind(this));
};

FormGenie.prototype.validatorProxy = function(validator) {
    var fg = this;

    return function(field) {
        field.setState(null);
        var result = validator.validator(field);
        if (!result) {
            fg.errors.push(new FGError(validator, field));
        } else {
            if (typeof validator.success !== "undefined") {
                validator.success(field);
            }
            field.setState(true);
        }
        return result;
    };
};
FormGenie.prototype.runValidator = function(validator) {
    if (!validator.resolved) {
        validator.targets = this.resolveTargets(validator, this.form);
        validator.resolved = true;
        validator.resolved_at = new Date();
    }

    var targets = validator.targets;
    validator = this.validatorProxy(validator);
    var results = this._iterate(targets, validator);
    return this._allTrueOrFalse(results);
};

FormGenie.prototype._allTrueOrFalse = function(array) {
    for (var i = 0, len = array.length; i < len; i++) {
        if (!array[i]) {
            return false;
        }
    }
    return true;
};

// TODO: implement this. ;)
FormGenie.prototype.isValidValidator = function(validator) {
    return true;
};

FormGenie.prototype.debug = function(msg) {
    if (this.DEBUG) {
        console.log(msg);
    }
};


FormGenie.prototype.resolveTargetOne = function(target) {
    return this.resolveTarget(target)[0];
};

FormGenie.prototype.resolveChain = function(matcher, fginput) {
    var r = this.resolveTarget(matcher);

    if (r.length >= 1) {
        return r;
    }
    return undefined;
};

FormGenie.prototype.attachValidator = function(target, validator) {
    target.validators.push(validator);
    return target;
};

// TODO: clean up here as well.
FormGenie.prototype.resolveTarget = function(target) {
    var matcher = target.matcher;
    var attribute = target.attribute;
    var isRegexTest = (matcher instanceof RegExp);
    var root = this;
    var inputFields = this.getInputFields();

    targets = this._iterate(inputFields, function(inputField) {
        var fginput;
        var dataflag = attribute.toLowerCase() === "data";


        if (isRegexTest || target.comparer === FormGenie.COMPARER_REGEX) {
            // regex matcher
            if (matcher.test(inputField[attribute])) {
                fginput = new FGInput(inputField, root);
            }
        } else if (dataflag && inputField.dataset[matcher]) {
            fginput = new FGInput(inputField, root);
        } else if (inputField.getAttribute(attribute) == matcher) {
            fginput = new FGInput(inputField, root);
        } else if (target.comparer === FormGenie.COMPARER_IN) {
            if (attribute.toLowerCase() == "class") {
                if (inputField.classList.contains(matcher)) {
                    fginput = new FGInput(inputField, root);
                }
            }
        }


        // chain matcher here
        if (typeof target.andMatcher !== "undefined") {
            fginput = root.resolveChain(target.andMatcher, fginput);
        }

        if (typeof target.orMatcher !== "undefined" && typeof fginput === "undefined") {
            fginput = root.resolveTarget(target.orMatcher); // try the same using orMatcher.
            console.log(fginput);
            //     console.log(fginput);
        }

        // if a field matches, do not return the field if .inverse flag is true
        if (target.inverse && typeof fginput !== "undefined") {
            return undefined;
        }

        // check if inverse flag is set, if so: return the input field
        if (typeof fginput === "undefined") {
            if (target.inverse) {
                return new FGInput(inputField, root);
            } else {
                return undefined;
            }
        }


        return fginput;
    });

    return targets;

};

FormGenie.prototype.resolveTargets = function(validator, form) {
    var validatorTargets = validator.targets;
    var result = [];
    var targets = this._iterate(validatorTargets, this.resolveTarget.bind(this))[0];
    if (typeof validator.exclude !== "undefined") {
        for (var i = 0, len = targets.length; i < len; i++) {
            var target = targets[i];
            if (validator.exclude.indexOf(target.getFGClass()) === -1) {
                result.push(target);
            }
        }
        targets = result;
        result = null;
    }
    var addons = validator.addons;
    result = [];
    if (typeof addons !== "undefined" && addons.length !== 0) {
        for (var j = 0, length = addons.length; j < length; j++) {
            var addon = addons[j];
            for (var k = 0, targetLength = targets.length; k < targetLength; k++) {

                result.push(addon(targets[k]));
            }
        }
    } else {
        result = targets;
    }
    //targets = this._iterate(targets, this.attachValidator.bind(this));
    targets = null;
    return result;
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
FormGenie.prototype.addValidator = function(validator) {
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

FormGenie.prototype.addConventionValidators = function() {
    // add _confirmation validator
    this.addValidator({
        "name": "Confirmation Validator",
        "targets": [{
            "matcher": /^(.*)_confirmation$/i,
            attribute: "name"
        }],
        "convention": true,
        "validator": function(field) {
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
        "targets": [{
            matcher: /^(terms|tos|terms_of_service|terms_of_usage|agb|privacy_agreement)$/i,
            attribute: "name"
        }],
        "autoresolve": true,

        "validator": function(checkbox) {
            return checkbox.isChecked();
        },

        "error": function(inputField) {
            inputField.getLabel().shareState();
        },

        "success": function(inputField) {
            inputField.getLabel().shareState();
        },

        "addons": [
            FormGenie.addons.FilterLabel
        ]
    });


    this.addValidator({
        "name": "E-Mail Validator",
        "targets": [{
            "matcher": /^email$/i,
            attribute: "name"
        }, {
            "matcher": /^email$/i,
            attribute: "type"
        }],
        "autoresolve": true,
        "validator": function(field) {
            // this is just a basic email validator.
            return /\S+@\S+\.\S+/.test(field.getValue());

        },
        "addons": []
    });


    this.addValidator({
        "name": "Value Validator",
        "targets": [
            FormGenie.not({
                "matcher": "optional",
                attribute: "data",
            }),
        ],

        "exclude": [
            FormGenie.CHECKBOX,
            FormGenie.RADIO
        ],
        "autoresolve": true,
        "validator": function(field) {
            return (field.getValue());
        },
        "addons": []
    });


    this.addValidator({
        "name": "Regex Validator",
        "targets": [{
            "matcher": "regex",
            attribute: "data"
        }],
        "autoresolve": true,
        "validator": function(field) {
            var regex = RegExp(field.getDataAttribute('regex'), field.getDataAttribute('regex-flags', ''));
            return regex.test(field.getValue());
        }
    });

    this.addValidator({
        "name": "Date Validation",
        "targets": [{
            "matcher": /^(day|month|year)$/i,
            "attribute": "name"
        }],

        "autoresolve": true,
        "validator": function(field) {
            var name = field.getName();
            var valid = false;
            switch (name.toLowerCase()) {
                case "day":

                    break;

                case "month":
                    break;

                case "year":
                    break;

                default:

            }
            return valid;
        },
        "addons": []
    });
};

FormGenie.prototype.magicForm = function() {
    this.addConventionValidators();
};

FormGenie.prototype._iterate = function(array, iterator, include_undefined) {
    include_undefined = include_undefined || false;
    var results = [];
    var result;
    for (var i = 0, len = array.length; i < len; i++) {
        result = iterator(array[i]);
        if (typeof result !== "undefined" || include_undefined) {
            results.push(result);
        }

    }
    return results;
};

window.FormGenie = FormGenie;

/* this is an example of plugin injection. */
var MyLabelPlugin = function(label, fg) {
    this.fg = fg;
    this.label = label;

    this.shareState = function() {
        var state = this.fg.getState();
        this.setState(state);

    };
    // repeated for demonstration purposes
    this.setState = function(state) {
        if (state == "invalid" || state === false) {
            this.label.classList.remove('fg-input-valid');
            this.label.classList.add('fg-input-invalid');
        } else if (state == "valid" || state === true) {
            this.label.classList.remove('fg-input-invalid');
            this.label.classList.add('fg-input-valid');
        } else {
            this.label.classList.remove('fg-input-invalid');
            this.label.classList.remove('fg-input-valid');
        }
    };

    return this;
};
FormGenie.addons.FilterLabel = function(fg_field) {
    fg_field.getLabel = function() {
        var name = this.getName();
        var labels = this.form.$('label');

        for (var i = 0, len = labels.length; i < len; i++) {
            var label = labels[i];
            if (label.getAttribute("for") == name) {
                return new MyLabelPlugin(label, this);
            }
        }
    };
    return fg_field;
};



/** Another example plugin
 * Add .getCompanion method which gets related input fields (password, password_confirmation)
 * @param fg_field FormGenie Input Class
 * @param fg_form FormGenie Form Class
 * @returns {*[]} Array containing modified input & form classes2
 */
FormGenie.addons.CompanionAddon = function(fg_field) {
    fg_field.getCompanion = function() {
        var field = this.getName();
        if (/(.+)_confirmation/i.test(field)) {
            var companion = field.match(/(.+)_confirmation/i)[1];
            var companionField = this.form.resolveTargetOne({
                matcher: companion,
                attribute: "name"
            });
            return companionField;
        } else {
            this.form.debug("Can't run getCompanion on: " + field);
            return false;
        }
    };

    if (typeof fg_field !== "undefined")
    // share state with companion
        fg_field.addEventListener('state:changed', function() {
            if (/(.+)_confirmation/i.test(fg_field.getName())) {
                var state = fg_field.getState();
                var companion = fg_field.getCompanion();
                companion.setState(state);
            }
        });

    return fg_field;
};