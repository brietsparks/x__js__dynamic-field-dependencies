/**
 *          Pub Elem ----------------------> State (active/inactive)
 *                            has               | publisher
 *                                              |
 *                                              | notifies (when State is active)
 *                                              |
 *                          modifies            | subscriber
 *          Sub Elem <---------------------- Modifier
 *
 */

/**
 *       An element can either be a
 *            Pub (dependency)
 *            Sub (dependent)
 *
 *       A pub element has multiple states, each either active or inactive
 *
 *       An active state will notify an attached modifier
 *
 *       The notified modifier will modify the Sub element
 */

var FieldDependencies = (function() {
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
    this.elementsContainer = (function(getElementKey) {
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

        // whenever the DOM $element changes, have all the active State objects notify their listening Modifiers
        var self = this;
        this.$element.change(function (event) {
            var activeStates = self.getActiveStates();
            console.log(activeStates);
            for(var i in activeStates) {
                if (activeStates[i].hasOwnProperty('notify')) {
                    activeStates[i].notify();
                }
            }
        }).bind(self);

        /**
         * Return a key/State object-literal of the active states
         *
         * @returns {{}}
         */
        this.getActiveStates = function () {
            var activeStates = {};
            var states = this.states;
            for(var i in states) {
                if(states[i].hasOwnProperty('isActive') && states[i].isActive()) {
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
     * Represents the state of Element evaluated by a callback function
     * Can have one or more Modifiers listening to when it is active
     *
     * @param callback
     * @constructor
     */
    function State(callback) {
        this.element = null;
        this.callback = callback;
        this.modifiers = [];

        /**
         * Notify all attached modifiers to modify their element
         */
        this.notify = function () {
            for (var i in this.modifiers) {
                this.modifiers[i].execute();
            }
        };
        this.isActive = function () {
            return this.callback(this.element.$element);
        };
        this.setElement = function(element) {
            this.element = element;
            return this;
        };
        this.addModifier = function(modifier) {
            this.modifiers.push(modifier);
        };
    }

    /**
     * Modifies an Element via its callback function when any of its attached states are active
     * Listens to one or more States for their when they are active
     *
     * @param callback
     * @constructor
     */
    function Modifier(callback) {
        this.element = null;
        this.callback = callback;
        this.states = [];

        /**
         * Execute the modification on the element
         *
         * @returns {*}
         */
        this.execute = function () {
            return this.callback(this.element.$element);
        };
        this.setElement = function(element) {
            this.element = element;
            return this;
        };
        this.listen = function (state) {
            state.addModifier(this);
            this.states.push(state);
        }
    }

    /**
     * @param $pubElem
     * @param pubStateName
     * @param $subElem
     * @param subModifierName
     */
    this.createDependency = function($pubElem, pubStateName, $subElem, subModifierName) {
        var pubElem = that.elementsContainer.resolve($pubElem);

        if (!pubElem.getState(pubStateName)) {
            pubElem.attachState(pubStateName, that.statesContainer.get(pubStateName) );
        }

        var subElem = that.elementsContainer.resolve($subElem);
        if (!subElem.getModifier(subModifierName)) {
            subElem.attachModifier(subModifierName, that.modifiersContainer.get(subModifierName) );
        }


        var pubState = pubElem.getState(pubStateName);
        var subModifier = subElem.getModifier(subModifierName);
        subModifier.listen(pubState);
    };

    return {
        addState: function (name, callback) {
            that.statesContainer.add(name, new State(callback));
        },
        addModifier: function(name, callback) {
            that.modifiersContainer.add(name, new Modifier(callback));
        },
        createDependency: function($pubElem, pubStateName, $subElem, subModifierName) {
            that.createDependency($pubElem, pubStateName, $subElem, subModifierName);
        },

        setElementKeyCallback: function (callback) {
            that.getElementKey = callback;
        },

        getThat: function () {
            return [
                that.elementsContainer,
                that.statesContainer
            ];
        }
    }
})();