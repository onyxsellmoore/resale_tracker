package com.bookingplatform.regression;

import com.intuit.karate.junit5.Karate;

class RegressionSuite {

    @Karate.Test
    Karate testAll() {
        return Karate.run("classpath:features").relativeTo(getClass());
    }
}
