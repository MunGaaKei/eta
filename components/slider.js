function formatNavs ( n ) {
    return '';
}

function initItems ( nodes ) {
    Array.from(nodes).map(node => {
        // console.log(node);
    });
}

function addListeners ( slider ) {

}

export default class extends HTMLElement {

    constructor () {
        super();

        let { children } = this;
        
        initItems( children );

    }

    connectedCallback () {
        
    }

    disconnectedCallback () {

    }

};