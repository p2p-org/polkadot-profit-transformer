package test;

import io.confluent.ksql.function.udf.Udf;
import io.confluent.ksql.function.udf.UdfDescription;
import io.confluent.ksql.function.udf.UdfParameter;

@UdfDescription(
    name = "is_validator",
    description = "is validator",
    version = "test",
    author = "pr0n00gler"
)
public class IsValidatorUDF {
    @Udf(description = "is validator")
    public Boolean isValidator(
            @UdfParameter(value = "extrinsics")
            final String extrinsics,
            @UdfParameter(value = "accountID")
            final String accountID) {
        return extrinsics.contains("callIndex\":\"0x0712\",\"args\":{\"validator_stash\":\""+accountID);
    }
}