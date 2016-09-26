var FieldDependencies = (function () {
    var that = this;

    /**
     * A key/object store for States
     */
    this.statesContainer = {
        states: {},

        /**
         * @param key
         * @param {State} state
         */
        add: function (key, state) {
            this.states[key] = state;
        },

        /**
         * Get a clone of the state object, by key
         *
         * @param key
         * @returns {State}
         */
        get: function (key) {
            var state = this.states[key];
            return new State(state.callback);
        }
    };

    /**
     * A key/object store for Modifiers
     */
    this.modifiersContainer = {
        modifiers: {},

        /**
         * @param key
         * @param modifier
         */
        add: function (key, modifier) {
            this.modifiers[key] = modifier;
        },

        /**
         * Get a clone of the modifier object, by key
         *
         * @param key
         * @returns {Modifier}
         */
        get: function (key) {
            var modifier = this.modifiers[key];
            return new Modifier(modifier.callback);
        }
    };

    /**
     * Define what part of the $element to use as the key in the Element container
     *
     * @param $element
     * @returns {*}
     */
    this.getElementKey = function ($element) {
        return $element.attr('id');
    };

    /**
     * A key/object store for Elements
     */
    this.elementsContainer = (function (getElementKey) {
        this.elements = {};
        this.getElementKey = getElementKey;

        this.get = function ($element) {
            var key = this.getElementKey($element);
            if (this.elements.hasOwnProperty(key)) {
                return this.elements[key];
            }
        };

        that = this;
        return {
            elements: that.elements,

            /**
             * Resolve a singleton Element object, given a JQuery $element
             *
             * @param $element
             * @returns {Element}
             */
            resolve: function ($element) {
                var element = that.get($element);

                if (!element) {
                    var key = that.getElementKey($element);
                    element = new Element($element);
                    that.elements[key] = element;
                }

                return element;
            }
        }
    })(this.getElementKey);

    /**
     * @param $element
     * @constructor
     */
    function Element($element) {
        this.$element = $element;

        this.states = {};
        this.modifiers = {};

        // whenever the dependency DOM $element changes, have all the active State objects notify their subscribing Modifiers
        var self = this;
        var modifyDependents = function () {
            var activeStates = self.getActiveStates();
            for(var i in activeStates) {
                if (activeStates[i].hasOwnProperty('publish')) {
                    activeStates[i].publish();
                }
            }
        };
        this.$element.change(modifyDependents);

        /**
         * Called when cascading
         */
        this.modifyDependents = function () {
            modifyDependents();
        };

        /**
         * Return a key/State object-literal of the active states
         *
         * @returns {{}}
         */
        this.getActiveStates = function () {
            var activeStates = {};
            var states = this.states;
            for (var i in states) {
                if (states[i].hasOwnProperty('isActive') && states[i].isActive()) {
                    activeStates[i] = states[i];
                }
            }

            return activeStates;
        };

        this.attachState = function (key, state) {
            this.states[key] = state.setElement(this);
        };
        this.getState = function (key) {
            return this.states[key];
        };
        this.attachModifier = function (key, modifier) {
            this.modifiers[key] = modifier.setElement(this);
        };
        this.getModifier = function (key) {
            return this.modifiers[key];
        };
    }

    /**
     * Represents the state of a dependency Element
     *
     * @param callback The function used to evaluate if the state is active
     * @constructor
     */
    function State(callback) {
        this.element = null;
        this.callback = callback;
        this.modifiers = [];

        /**
         * Notify subscribing modifiers to modify their element
         */
        this.publish = function () {
            for (var i in this.modifiers) {
                this.modifiers[i].execute();
            }
        };

        /**
         * Is the dependency Element in this state?
         *
         * @return {*}
         */
        this.isActive = function () {
            return this.callback(this.element.$element);
        };

        /**
         * Set the dependency Element
         *
         * @param element
         * @return {State}
         */
        this.setElement = function (element) {
            this.element = element;
            return this;
        };

        /**
         * Add the Modifier to a subscriber list
         *
         * @param modifier
         */
        this.addModifier = function (modifier) {
            this.modifiers.push(modifier);
        };
    }

    /**
     * Modifies a dependent Element upon one or more State changes.
     *
     * @param callback
     * @constructor
     */
    function Modifier(callback) {
        this.element = null;
        this.callback = callback;
        this.states = [];

        /**
         * Execute the modification on the element and cascade
         *
         * @returns {*}
         */
        this.execute = function () {
            // the element is a dependent, so perform a callback on it to modify it
            this.callback(this.element.$element);

            // the element might also be a dependency, so do the same to its dependents (cascade)
            this.element.modifyDependents();
        };

        /**
         * Set the dependent Element
         * 
         * @param element
         * @return {Modifier}
         */
        this.setElement = function (element) {
            this.element = element;
            return this;
        };

        /**
         * Subscribe to a State
         * 
         * @param state
         */
        this.subscribe = function (state) {
            state.addModifier(this);
            this.states.push(state);
        }
    }

    /**
     * Set up a relationship between a dependency and dependent element so that the
     * dependent element undergoes the given modification when the dependency element
     * is in the given state.
     *
     * @param $dependencyElement
     * @param dependencyStateName
     * @param $dependentElement
     * @param dependentModifierName
     * @param inheritState
     */
    this.createRelationship = function (
        $dependencyElement, dependencyStateName, 
        $dependentElement, dependentModifierName, 
        inheritState
    ) {
        var dependencyElement = that.elementsContainer.resolve($dependencyElement);

        if (!dependencyElement.getState(dependencyStateName)) {
            dependencyElement.attachState(dependencyStateName, that.statesContainer.get(dependencyStateName));
        }

        var dependentElement = that.elementsContainer.resolve($dependentElement);
        if (!dependentElement.getModifier(dependentModifierName)) {
            dependentElement.attachModifier(dependentModifierName, that.modifiersContainer.get(dependentModifierName));
        }

        var pubState = dependencyElement.getState(dependencyStateName);
        var subModifier = dependentElement.getModifier(dependentModifierName);
        subModifier.subscribe(pubState);

        if (inheritState) {
            if (dependencyElement.getModifier(dependentModifierName)) {
                var cascadingStates = dependencyElement.getModifier(dependentModifierName).states;
                for (var key in cascadingStates) {
                    subModifier.subscribe(cascadingStates[key]);
                }
            }
        }
    };

    return {
        addState: function (name, callback) {
            that.statesContainer.add(name, new State(callback));
        },
        addModifier: function (name, callback) {
            that.modifiersContainer.add(name, new Modifier(callback));
        },
        createRelationship: function ($dependencyElement, dependencyStateName, $dependentElement, dependentModifierName, doNotInherit) {
            that.createRelationship($dependencyElement, dependencyStateName, $dependentElement, dependentModifierName, doNotInherit);
        },
        setElementKeyCallback: function (callback) {
            that.getElementKey = callback;
        }

        // ,getThat: function () {
        //     return {
        //         'elementsContainer': that.elementsContainer,
        //         'statesContainer': that.statesContainer
        //     }
        // }
    }
})();