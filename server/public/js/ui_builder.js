/**
 * UI Builder Framework
 * A minimalist system for component registration and injection.
 */
class UIBuilder {
    constructor() {
        this.components = new Map();
    }

    /**
     * Register a component definition.
     * @param {string} name - Component name
     * @param {Object} definition - { template: (data) => string, onMount: (el, data) => void }
     */
    register(name, definition) {
        this.components.set(name, definition);
    }

    /**
     * Inject a component into a target element.
     * @param {string} targetId - ID of the mount point
     * @param {string} name - Registered component name
     * @param {Object} data - Data to pass to template and onMount
     */
    inject(targetId, name, data = {}) {
        const target = document.getElementById(targetId);
        const comp = this.components.get(name);
        
        if (!target) {
            console.error(`UI Injection failed: Target element #${targetId} not found.`);
            return;
        }
        
        if (!comp) {
            console.error(`UI Injection failed: Component '${name}' not found.`);
            return;
        }

        // Render template
        target.innerHTML = comp.template(data);

        // Run lifecycle hook
        if (comp.onMount) {
            comp.onMount(target, data);
        }
    }
}

export const UI = new UIBuilder();
