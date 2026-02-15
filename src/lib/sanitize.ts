/**
 * Content sanitization for stripping tracking and malicious elements.
 * Used by adapters and PostCard before rendering HTML content.
 */

const TRACKING_PIXEL_SELECTOR = 'img[width="1"][height="1"], img[width="0"], img[height="0"]';
const DANGEROUS_TAGS = ['script', 'iframe', 'object', 'embed', 'form'];
const DANGEROUS_ATTRS = [
    'onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur',
    'onsubmit', 'onchange', 'onkeydown', 'onkeyup', 'onkeypress'
];

/**
 * Sanitizes HTML content by removing:
 * - <script>, <iframe>, <object>, <embed>, <form> tags
 * - Inline event handlers (onclick, onload, etc.)
 * - 1x1 tracking pixels
 * - data: URIs in src attributes (potential XSS)
 */
export function sanitizeHTML(html: string): string {
    if (!html) return '';

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove dangerous tags entirely
    for (const tag of DANGEROUS_TAGS) {
        const elements = doc.querySelectorAll(tag);
        elements.forEach(el => el.remove());
    }

    // Remove tracking pixels
    const pixels = doc.querySelectorAll(TRACKING_PIXEL_SELECTOR);
    pixels.forEach(el => el.remove());

    // Remove dangerous attributes from all elements
    const allElements = doc.querySelectorAll('*');
    allElements.forEach(el => {
        for (const attr of DANGEROUS_ATTRS) {
            el.removeAttribute(attr);
        }
        // Remove data: URIs (potential XSS vector)
        const src = el.getAttribute('src');
        if (src && src.trim().toLowerCase().startsWith('data:')) {
            el.removeAttribute('src');
        }
        // Remove javascript: URIs in href
        const href = el.getAttribute('href');
        if (href && href.trim().toLowerCase().startsWith('javascript:')) {
            el.removeAttribute('href');
        }
    });

    return doc.body.innerHTML;
}
