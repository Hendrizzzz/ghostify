import { decode } from './network.js';

export function createBlockedPayload(blockType, url, body) {
    const decoded = decode(body).toLowerCase();
    const isGraphQL = String(url || '').includes('/api/graphql') ||
        decoded.includes('fb_api_req_friendly_name') ||
        decoded.includes('doc_id');

    if (!isGraphQL) {
        return { status: 'ok', blocked: blockType };
    }

    if (
        String(url || '').includes('facebook.com/api/graphql') &&
        (blockType === 'MSG_SEEN' || blockType === 'MSG_TYPING')
    ) {
        return { data: {} };
    }

    if (blockType === 'IG_STORY') {
        if (
            decoded.includes('xdt_api__v1__stories__reel__seen') ||
            decoded.includes('polarisapiforcestoryseenmutation') ||
            decoded.includes('9647304595318258')
        ) {
            return {
                data: {
                    xdt_api__v1__stories__reel__seen: {
                        __typename: 'XDTEmptyRecord'
                    }
                }
            };
        }

        return {
            data: {
                xdt_mark_story_reel_seen: {
                    __typename: 'XDTMarkSeenResponse'
                }
            }
        };
    }

    return { data: {} };
}
