;(function(global, factory){

    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = global || self, global.eta = factory());

})(this, function(){
    
    const ETA = {};
    const STORE = {};           // Template Store
    const MAP = new Map();      //
    
    var Target = null;          // Current Component
    var Cache  = {};            // Temporarily Save Map Data
    var Context= {};            // Script Context
    var Events = [];            // Temporarily Save Event Listeners
    var Styles = {};            // Save styles


    /*
    **  Search template by tag from STORE
    */
    function search ( tag ) {
        if ( !STORE[tag] ) {
            STORE[tag] = document.querySelector(`template[name=${tag}]`);
        }
        return STORE[tag];
    }



    /*
    **  Mixin Object into HTMLElement
    */
    function mixin ( obj ) {
        let { init, mounted, removed } = obj;
        return class extends HTMLElement {
            constructor () {
                super ();
                defaultInit( this, obj );
                init && init.call(this);
            }
            connectedCallback () {
                mounted && mounted.call(this);
            }
            disconnectedCallback () {
                removed && removed.call(this);
            }
        }
    }



    /*
    **  Format component with <template>
    **  Deal with <template>.content
    */
    function format ( tpl, config = {} ) {
        let { init, mounted, removed } = config;
        return class extends HTMLElement {
            constructor () {
                super ();
                config.template = document.importNode(tpl.content, true);

                defaultInit( this, config );

                init && init.call(this);
            }
            connectedCallback () {
                tpl && tpl.remove();
                mounted && mounted.call(this);
            }
            disconnectedCallback () {
                clearMemory( this );
                removed && removed.call(this);
            }
        }
    }



    /*
    **  Default initialization
    */
    function defaultInit ( target, config ) {
        let { template, pure } = config;
        
        let slots = handleSlots(target);
        template = typeof template === 'string'? string2html(template): template;

        if ( !pure ) {
            Target = target;

            var data = bindData();
            parse(template, slots, data);

            Target = Cache = null;
        }
        
        target.append(template);
        bindListeners( config, target.tagName.toLowerCase() );
        Events = [];
        template = slots = null;
    }



    /*
    **  Transvert string to html node
    */
    function string2html ( string ) {
        var tpl = document.createElement('TEMPLATE');
        tpl.innerHTML = string;
        return tpl.content;
    }
    



    /*
    **  Handle with target's slots
    */
    function handleSlots ( target, slots = {} ) {
        let { children } = target;
        Array.from( children ).map(node => {
            if ( node.nodeType === 1 && node.hasAttribute('slot') ) {
                let name = node.getAttribute('slot');
                let frag = slots[name] || document.createDocumentFragment();
                frag.append(node);
                node.removeAttribute('slot');
                slots[name] = frag;
            }
        });
        return slots;
    }



    /*
    **  Bind attributes data on target element
    */
    function bindData () {
        let attrs = Target.attributes;
        let data = {};
        let map = {};

        if ( !attrs.length ) return;

        for ( let attr of attrs ) {
            data[attr.name] = attr.value;
        }

        MAP.set(Target, map);

        return new Proxy(data, {
            get (tar, key) {

                if ( Target ) {
                    buildMaps( map, key );
                }

                return Reflect.get(tar, key);
            },
            set (tar, key, val, rec) {
                tar[key] = val;
                updateNodes( map, rec, key );
                return true;
            }
        });
    }



    /*
    **  Bind listeners on target nodes
    */
    function bindListeners ( context, tag ) {
        for ( let evt of Events ) {
            let { node, event, fn } = evt;
            if ( !context[fn] ) {
                context = Context[tag];
            }
            node.addEventListener(
                event,
                context[fn].bind(context)
            );
        }
    }




    /*
    **  Parse <template>.content
    **  1. replace slots with nodes
    **  2. compile text node with data
    **  3. extract style and put it in <style scope="eta" />
    */
    function parse ( content, slots, data ) {
        let nodes = content.childNodes;
        for ( let node of nodes ) {
            if ( node.nodeType === 1 ) {
                switch (node.tagName) {
                    case 'SLOT':
                        let frag = document.createDocumentFragment();
                        let name = node.getAttribute('name');

                        Array.from(Target.childNodes).map(child => {
                            if ( name && slots[name] ) {
                                node.replaceWith( slots[name] );
                            } else {
                                frag.append(child);
                            }
                        });
                        
                        node.replaceWith( frag );
                        break;
                    
                    case 'STYLE':
                        insertStyle( Target.tagName.toLowerCase(), node );
                        break;

                    case 'SCRIPT':
                        // node.remove();
                        break;

                    default:
                        handleAttributes( node );
                        parse( node, slots, data );
                    break;
                }

            } else if ( node.nodeType === 3 ) {
                node.textContent = compile(node.textContent, data || {}, node);
            }
        }
    }




    /*
    **  Compile text node with data
    **  match text like: #param#
    */
    function compile ( text, data, node ) {
        return text.replace(/#(.*?)#/gm, match => {
            var prop = match.slice(1, -1).trim();
            
            if ( Target ) {
                Cache = { node, raw: text };
            }

            return data[prop] || '';
        });
    }




    /*
    **  Handle with special attributes on node
    */
    function handleAttributes ( node ) {
        var attrs = node.attributes;
        for ( let attr of attrs ) {
            let { name, value } = attr;
            if ( name.startsWith('@') ) {
                Events.push({
                    node,
                    event: name.substr(1),
                    fn: value
                });
                node.removeAttribute(name);
            } else if ( name.startsWith(':') ) {
                // reserved
                node.removeAttribute(name);
            }
        }
    }





    /*
    **  Update the relation among ⬇
    **  node <==> property <==> rawtext
    */
    function buildMaps ( map, prop ) {
        let tree = map[prop];
        if ( tree ) {
            tree.set(Cache.node, Cache.raw);
        } else {
            map[prop] = new Map().set(Cache.node, Cache.raw);
        }
    }



    /*
    **  Clear the memory of [target]
    */
    function clearMemory ( target ) {
        let map = MAP.get(target);
        for (let o in map) {
            for (let [node] of map[o] ) {
                node = null;
            }
            map[o].clear();
            map[o] = null;
        }
        MAP.delete(target);
        target = null;
    }




    /*
    **  Insert style of Component[tag]
    */
    var DOMStyle = document.createElement('style');
    DOMStyle.setAttribute('scope', 'eta');
    document.head.append(DOMStyle);
    function insertStyle ( tag, node ) {
        if ( !Styles[tag] ) {
            node.setAttribute('name', tag);
            DOMStyle.append(node);
            Styles[tag] = node;
        } else {
            node.remove();
        }
    }




    /*
    **  Update nodes by MAP
    */
    function updateNodes ( map, data, prop ) {
        let tree = map[prop];
        if ( tree ) {
            for ( let [key, val] of tree.entries() ) {
                if ( key ) {
                    key.textContent = compile(val, data);
                }
            }
        }
    }



    // /*
    // **  Fetch html template
    // */
    // async function load ( url, tag ) {
    //     let res = await fetch(url, {
    //         headers: {
    //             "Content-Type": "text/html; charset=UTF-8"
    //         },
    //     });
    //     let html = await res.text();

    //     html = extractStyles( html, tag );

    //     return mixin({
    //         template: html,
    //         init () {
                
    //         }
    //     });
    // }


    // /*
    // **  Extract styles from the template
    // */
    // function extractStyles ( text, tag ) {
    //     return text.replace(/<style[^>]*?>(?:.|\n)*?<\/style>/ig, function ( match ) {
    //         Styles[tag] = match;
    //         return '';
    //     });
    // }
    


    /*
    **  Check if the [Component] has been defined
    */
    function isRigistered ( tag ) {
        if ( STORE[tag] ) {
            console.error(`The component has been registered: [${tag}]`);
            return true;
        } else {
            return false;
        }
    }



    /*
    **  Install [Component] with template by tag
    */
    function install ( tag, config = {}, template ) {
        if ( isRigistered(tag) ) {
            return;
        }
        customElements.define(
            tag,
            format(
                template || search(tag),
                config
            )
        );
    }

    


    /*
    **  Use [Components] which from importing
    **  ${Component} <Object> || <Class> || <String>
    */
    ETA.use = function use ( component, tag ) {
        if ( isRigistered(tag) ) {
            return;
        }
        if ( typeof component === 'string' ) {
            load( component, tag ).then(component => {
                customElements.define(
                    tag,
                    component
                );
            });
        } else {
            let isHTMLElementType = Object.prototype.toString.call(component.prototype) === '[object HTMLElement]';

            customElements.define(
                tag,
                isHTMLElementType? component: mixin( component )
            );
        }
        STORE[tag] = true;
    }



    /*
    **  Set context for a component
    */
    ETA.set = function set ( tag, context ) {
        Context[tag] = context;
    }




    /*
    **  Regist [Component] when document loaded
    */
    document.addEventListener('DOMContentLoaded', function(){
        var templates = document.querySelectorAll('template[name]');
        templates && templates.forEach(function(tpl){
            var tag = tpl.getAttribute('name');
            install(
                tag,
                {},
                tpl
            );
        });
    });



    return ETA;

});