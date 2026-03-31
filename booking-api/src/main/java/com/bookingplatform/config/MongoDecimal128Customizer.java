package com.bookingplatform.config;

import com.mongodb.MongoClientSettings;
import io.quarkus.mongodb.runtime.MongoClientCustomizer;
import jakarta.enterprise.context.ApplicationScoped;
import org.bson.codecs.configuration.CodecRegistries;
import org.bson.codecs.pojo.PojoCodecProvider;

/**
 * Registers custom BSON codecs and the automatic POJO codec provider.
 * The ItemStatusCodec is registered first so it takes priority over the
 * default enum handling, allowing graceful fallback to UNKNOWN for
 * unrecognized status values in the database.
 */
@ApplicationScoped
public class MongoDecimal128Customizer implements MongoClientCustomizer {

    @Override
    public MongoClientSettings.Builder customize(MongoClientSettings.Builder builder) {
        return builder.codecRegistry(
                CodecRegistries.fromRegistries(
                        MongoClientSettings.getDefaultCodecRegistry(),
                        CodecRegistries.fromCodecs(new ItemStatusCodec()),
                        CodecRegistries.fromProviders(
                                PojoCodecProvider.builder()
                                        .automatic(true)
                                        .register(new ItemStatusPropertyCodecProvider())
                                        .build()
                        )
                )
        );
    }
}
