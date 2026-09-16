const { randomUUID } = require("crypto");

const BookingConfirmationLock = require(
  "../../models/tengaAgent/BookingConfirmationLock"
);

const DEFAULT_LEASE_MS = 30000;
const DEFAULT_WAIT_MS = 5000;
const RETRY_DELAY_MS = 50;

const delay = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const acquireBookingConfirmationLock = async ({
  organizationId,
  agentId,
  leaseMs = DEFAULT_LEASE_MS,
  waitMs = DEFAULT_WAIT_MS,
}) => {
  if (!organizationId || !agentId) {
    throw new Error(
      "Appointment confirmation lock context is incomplete."
    );
  }

  const ownerToken = randomUUID();
  const deadline = Date.now() + waitMs;

  while (Date.now() <= deadline) {
    const now = new Date();
    const lockedUntil = new Date(
      now.getTime() + leaseMs
    );

    try {
      const lock =
        await BookingConfirmationLock.findOneAndUpdate(
          {
            organizationId,
            agentId,
            $or: [
              {
                lockedUntil: {
                  $lte: now,
                },
              },
              {
                lockedUntil: {
                  $exists: false,
                },
              },
              {
                ownerToken: "",
              },
            ],
          },
          {
            $set: {
              ownerToken,
              lockedUntil,
            },
          },
          {
            upsert: true,
            returnDocument: "after",
            setDefaultsOnInsert: true,
          }
        );

      if (
        lock &&
        lock.ownerToken === ownerToken
      ) {
        return {
          ownerToken,
          lockedUntil,
        };
      }
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }
    }

    if (Date.now() <= deadline) {
      await delay(RETRY_DELAY_MS);
    }
  }

  throw new Error(
    "Appointment confirmation is busy. Please retry."
  );
};

const releaseBookingConfirmationLock = async ({
  organizationId,
  agentId,
  ownerToken,
}) => {
  if (!organizationId || !agentId || !ownerToken) {
    return;
  }

  await BookingConfirmationLock.updateOne(
    {
      organizationId,
      agentId,
      ownerToken,
    },
    {
      $set: {
        ownerToken: "",
        lockedUntil: new Date(0),
      },
    }
  );
};

const withBookingConfirmationLock = async ({
  organizationId,
  agentId,
  leaseMs,
  waitMs,
  task,
}) => {
  if (typeof task !== "function") {
    throw new Error(
      "Appointment confirmation lock task is required."
    );
  }

  const lock =
    await acquireBookingConfirmationLock({
      organizationId,
      agentId,
      leaseMs,
      waitMs,
    });

  try {
    return await task();
  } finally {
    await releaseBookingConfirmationLock({
      organizationId,
      agentId,
      ownerToken: lock.ownerToken,
    });
  }
};

module.exports = {
  acquireBookingConfirmationLock,
  releaseBookingConfirmationLock,
  withBookingConfirmationLock,
};
