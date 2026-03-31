package com.bookingplatform.config;

import com.bookingplatform.model.ItemStatus;
import org.bson.codecs.Codec;
import org.bson.codecs.pojo.PropertyCodecProvider;
import org.bson.codecs.pojo.PropertyCodecRegistry;
import org.bson.codecs.pojo.TypeWithTypeParameters;

/**
 * Provides the {@link ItemStatusCodec} to the POJO codec provider so that
 * {@link ItemStatus} fields on Panache entities use graceful fallback
 * to {@link ItemStatus#UNKNOWN} for unrecognized database values.
 */
public class ItemStatusPropertyCodecProvider implements PropertyCodecProvider {

    @Override
    @SuppressWarnings("unchecked")
    public <T> Codec<T> get(TypeWithTypeParameters<T> type, PropertyCodecRegistry registry) {
        if (type.getType().equals(ItemStatus.class)) {
            return (Codec<T>) new ItemStatusCodec();
        }
        return null;
    }
}
