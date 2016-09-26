     Dependency Element [one] ---------> [many] State (publisher)
                                                [many]
                                                  |
                                                  |
                                                  |
                                                  |
                                                [many]
     Dependent Element [one] <--------- [many] Modifier (subscriber)
     
- Dependency Element: 
    - an element whose state(s) affects one or more dependent elements
- Dependent Element: 
    - an element affected by the state of one or more dependency elements
- State: 
    - represents a user-defined state of a Dependency Element 
    - is either active or inactive at any given time
    - when active, it will notify one or more subscribing Modifiers
- Modifier: 
    - subscribes to one or more States
    - gets notified by each active State
    - when notified, it executes a callback on (i.e. modifies) a Dependent Element
