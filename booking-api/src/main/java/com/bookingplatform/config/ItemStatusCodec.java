package com.bookingplatform.config;

import com.bookingplatform.model.ItemStatus;
import org.bson.BsonReader;
import org.bson.BsonType;
import org.bson.BsonWriter;
import org.bson.codecs.Codec;
import org.bson.codecs.DecoderContext;
import org.bson.codecs.EncoderContext;

/**
 * Custom BSON codec for {@link ItemStatus} that maps unrecognized values
 * (e.g. legacy "DELETED") to {@link ItemStatus#UNKNOWN} instead of throwing.
 */
public class ItemStatusCodec implements Codec<ItemStatus> {

    @Override
    public ItemStatus decode(BsonReader reader, DecoderContext decoderContext) {
        if (reader.getCurrentBsonType() == BsonType.NULL) {
            reader.readNull();
            return null;
        }
        String value = reader.readString();
        try {
            return ItemStatus.valueOf(value);
        } catch (IllegalArgumentException e) {
            return ItemStatus.UNKNOWN;
        }
    }

    @Override
    public void encode(BsonWriter writer, ItemStatus value, EncoderContext encoderContext) {
        if (value == null) {
            writer.writeNull();
        } else {
            writer.writeString(value.name());
        }
    }

    @Override
    public Class<ItemStatus> getEncoderClass() {
        return ItemStatus.class;
    }
}
