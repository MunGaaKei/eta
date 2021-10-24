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

    var Styles = {};            // Save styles
    var Scripts= {};            // Save scripts


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
        let { init, mounted, removed, template } = obj;
        return class extends HTMLElement {
            constructor () {
                super ();
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
        let { init, mounted, removed, template, pure } = config;
        return class extends HTMLElement {
            constructor () {
                super ();

                let content = document.importNode(tpl.content, true);
                let slots = handleSlots(this);

                if ( !pure ) {
                    Target = this;

                    bindData();
                    parse(content, slots);

                    Target = Cache = null;
                }
                
                this.append(content);

                content = slots = null;
                init && init.call(this);
            }
            connectedCallback () {
                tpl && tpl.remove();
                mounted && mounted.call(this);
            }
            disconnectedCallback () {
                clearContext( this );
                removed && removed.call(this);
            }
        }
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

        Target.$data = new Proxy(data, {
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
    **  Parse <template>.content
    **  1. replace slots with nodes
    **  2. compile text node with data
    */
    function parse ( content, slots ) {
        let nodes = content.childNodes;
        for ( let node of nodes ) {
            if ( node.nodeType === 1 ) {
                if ( node.tagName === 'SLOT' ) {
                    let frag = document.createDocumentFragment();
                    let children = Target.childNodes;
                    let name = node.getAttribute('name');

                    for ( let child of children ) {
                        if ( name && slots[name] ) {
                            node.replaceWith( slots[name] );
                        } else {
                            frag.append(child);
                        }
                    }

                    node.replaceWith( frag );
                } else {
                    parse( node, slots );
                }
            } else if ( node.nodeType === 3 ) {
                node.textContent = compile(node.textContent, Target.$data, node);
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
    function clearContext ( target ) {
        let map = MAP.get(target);
        for (let o in map) {
            for (let [node] of map[o] ) {
                node = null;
            }
            map[o].clear();
            map[o] = null;
        }
        MAP.delete(target);
        target.$data = target = null;
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


    
    /*
    **  Fetch html template
    */
    async function load ( url, tag ) {
        let res = await fetch(url, {
            headers: {
                "Content-Type": "text/html; charset=UTF-8"
            },
        });
        let html = await res.text();

        html = extractStyles( html, tag );
        html = extractScripts( html, tag );

        return mixin({
            template: html,
            init () {
                
            }
        });
    }


    /*
    **  Extract styles from the template
    */
    function extractStyles ( text, tag ) {
        return text.replace(/<style[^>]*?>(?:.|\n)*?<\/style>/ig, function ( match ) {
            Styles[tag] = match;
            return '';
        });
    }

    /*
    **  Extract script from the template
    */
    function extractScripts ( text, tag ) {
        return text.replace(/<script[^>]*?>(?:.|\n)*?<\/script>/ig, function ( match ) {
            Scripts[tag] = match;
            return '';
        });
    }



    /*
    **  Install [Component] with template by tag
    */
    ETA.install = function install ( tag, config = {} ) {
        customElements.define(
            tag,
            format(
                search(tag),
                config
            )
        );
    }

    


    /*
    **  Use [Components] which from importing
    **  ${Component} <Object> || <Class> || <String>
    */
    ETA.use = function use ( component, tag ) {
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
                tag? tag: component.name,
                isHTMLElementType? component: mixin( component )
            );
        }
    }


    return ETA;

});