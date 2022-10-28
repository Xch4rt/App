import React from 'react';
import {View} from 'react-native';
import PropTypes from 'prop-types';
import lodashGet from 'lodash/get';
import _ from 'underscore';
import TextInput from '../../../components/TextInput';
import Picker from '../../../components/Picker';
import Text from '../../../components/Text';
import styles from '../../../styles/styles';
import withLocalize, {withLocalizePropTypes} from '../../../components/withLocalize';
import * as Expensicons from '../../../components/Icon/Expensicons';
import * as Illustrations from '../../../components/Icon/Illustrations';
import Section from '../../../components/Section';
import CopyTextToClipboard from '../../../components/CopyTextToClipboard';
import * as Link from '../../../libs/actions/Link';
import compose from '../../../libs/compose';
import * as Policy from '../../../libs/actions/Policy';
import CONST from '../../../CONST';
import Button from '../../../components/Button';
import getPermittedDecimalSeparator from '../../../libs/getPermittedDecimalSeparator';
import {withNetwork} from '../../../components/OnyxProvider';
import OfflineWithFeedback from '../../../components/OfflineWithFeedback';
import * as ReimbursementAccount from '../../../libs/actions/ReimbursementAccount';

const propTypes = {
    /** The policy ID currently being configured */
    policyID: PropTypes.string.isRequired,

    /** Does the user have a VBA in their account? */
    hasVBA: PropTypes.bool.isRequired,

    /** Policy values needed in the component */
    policy: PropTypes.shape({
        id: PropTypes.string,
        customUnits: PropTypes.objectOf(
            PropTypes.shape({
                customUnitID: PropTypes.string,
                name: PropTypes.string,
                attributes: PropTypes.shape({
                    unit: PropTypes.string,
                }),
                rates: PropTypes.arrayOf(
                    PropTypes.shape({
                        customUnitRateID: PropTypes.string,
                        name: PropTypes.string,
                        rate: PropTypes.number,
                    }),
                ),
            }),
            rate: PropTypes.arrayOf(PropTypes.shape({
                customUnitRateID: PropTypes.string,
                name: PropTypes.string,
                rate: PropTypes.number,
            })),
        })),
        outputCurrency: PropTypes.string,
        hasVBA: PropTypes.bool,
        lastModified: PropTypes.number,
    }).isRequired,

    ...withLocalizePropTypes,
};

class WorkspaceReimburseView extends React.Component {
    constructor(props) {
        super(props);
        const distanceCustomUnit = _.find(lodashGet(props, 'policy.customUnits', {}), unit => unit.name === 'Distance');

        debugger;
        this.state = {
            unitID: lodashGet(distanceCustomUnit, 'customUnitID', ''),
            unitName: lodashGet(distanceCustomUnit, 'name', ''),
            unitValue: lodashGet(distanceCustomUnit, 'attributes.unit', 'mi'),
            rateID: lodashGet(distanceCustomUnit, 'rates[0].customUnitRateID', ''),
            rateName: lodashGet(distanceCustomUnit, 'rates[0].name', ''),
            rateValue: this.getRateDisplayValue(lodashGet(distanceCustomUnit, 'rates[0].rate', 0) / 100),
            outputCurrency: lodashGet(props, 'policy.outputCurrency', ''),
        };

        this.unitItems = [
            {
                label: this.props.translate('workspace.reimburse.kilometers'),
                value: 'km',
            },
            {
                label: this.props.translate('workspace.reimburse.miles'),
                value: 'mi',
            },
        ];

        this.debounceUpdateOnCursorMove = this.debounceUpdateOnCursorMove.bind(this);
        this.updateRateValueDebounced = _.debounce(this.updateRateValue.bind(this), 1000);
    }

    getRateDisplayValue(value) {
        const numValue = parseFloat(value);
        if (Number.isNaN(numValue)) {
            return '';
        }

        return numValue.toFixed(3);
    }

    setRate(value) {
        const isInvalidRateValue = value !== '' && !CONST.REGEX.RATE_VALUE.test(value);

        this.setState(prevState => ({
            rateValue: !isInvalidRateValue ? value : prevState.rateValue,
        }), () => {
            // Set the corrected value with a delay and sync to the server
            this.updateRateValueDebounced(this.state.rateValue);
        });
    }

    static getDerivedStateFromProps(props, state) {
        const distanceCustomUnit = _.find(lodashGet(props, 'policy.customUnits', {}), unit => unit.name === 'Distance');
        const unitValue = lodashGet(distanceCustomUnit, 'attributes.unit', 'mi');

        if (unitValue !== state.unitValue) {
            return {
                unitValue,
            };
        }

        return null;
    }

    setUnit(value) {
        this.setState({unitValue: value});

        const distanceCustomUnit = _.find(lodashGet(this.props, 'policy.customUnits', {}), unit => unit.name === 'Distance');
        if (!distanceCustomUnit) {
            Log.warn('Policy has no customUnits, returning early.', {
                policyID: this.props.policy.id,
            });
            return;
        }

        const distanceCustomUnit = _.find(lodashGet(this.props, 'policy.customUnits', {}), unit => unit.name === 'Distance');

        Policy.updateWorkspaceCustomUnit(this.props.policyID, distanceCustomUnit, {
            customUnitID: this.state.unitID,
            customUnitName: this.state.unitName,
            attributes: {unit: value},
        }, this.props.policy.lastModified);
    }

    debounceUpdateOnCursorMove(event) {
        if (!_.contains(['ArrowLeft', 'ArrowRight'], event.key)) {
            return;
        }

        this.updateRateValueDebounced(this.state.rateValue);
    }

    updateRateValue(value) {
        const numValue = parseFloat(value);

        if (_.isNaN(numValue)) {
            return;
        }

        const distanceCustomUnit = _.find(lodashGet(this.props, 'policy.customUnits', {}), unit => unit.name === 'Distance');
        const currentCustomUnitRate = lodashGet(distanceCustomUnit, ['rates', this.state.unitRateID], {});
        Policy.updateCustomUnitRate(this.props.policy.id, currentCustomUnitRate, this.state.unitID, {
            ...currentCustomUnitRate,
            rate: numValue * CONST.POLICY.CUSTOM_UNIT_RATE_BASE_OFFSET,
        }, this.props.policy.lastModified);
    }

    render() {
        return (
            <>
                <Section
                    title={this.props.translate('workspace.reimburse.captureReceipts')}
                    icon={Illustrations.ReceiptYellow}
                    menuItems={[
                        {
                            title: this.props.translate('workspace.reimburse.viewAllReceipts'),
                            onPress: () => Link.openOldDotLink(`expenses?policyIDList=${this.props.policy.id}&billableReimbursable=reimbursable&submitterEmail=%2B%2B`),
                            icon: Expensicons.Receipt,
                            shouldShowRightIcon: true,
                            iconRight: Expensicons.NewWindow,
                        },
                    ]}
                >
                    <View style={[styles.mv4, styles.flexRow, styles.flexWrap]}>
                        <Text>
                            {this.props.translate('workspace.reimburse.captureNoVBACopyBeforeEmail')}
                            <CopyTextToClipboard
                                text="receipts@expensify.com"
                                textStyles={[styles.textBlue]}
                            />
                            <Text>{this.props.translate('workspace.reimburse.captureNoVBACopyAfterEmail')}</Text>
                        </Text>
                    </View>
                </Section>

                <Section
                    title={this.props.translate('workspace.reimburse.trackDistance')}
                    icon={Illustrations.GpsTrackOrange}
                >
                    <View style={[styles.mv4]}>
                        <Text>{this.props.translate('workspace.reimburse.trackDistanceCopy')}</Text>
                    </View>
                    <OfflineWithFeedback
                        errors={{
                            ...lodashGet(this.props, ['policy', 'customUnits', this.state.unitID, 'errors'], {}),
                            ...lodashGet(this.props, ['policy', 'customUnits', this.state.unitID, 'rates', this.state.unitRateID, 'errors'], {}),
                        }}
                        pendingAction={lodashGet(this.props, ['policy', 'customUnits', this.state.unitID, 'pendingAction'])
                                || lodashGet(this.props, ['policy', 'customUnits', this.state.unitID, 'rates', this.state.unitRateID, 'pendingAction'])}
                        onClose={() => Policy.clearCustomUnitErrors(this.props.policy.id, this.state.unitID, this.state.unitRateID)}
                    >
                        <View style={[styles.flexRow, styles.alignItemsCenter, styles.mv2]}>
                            <View style={[styles.rateCol]}>
                                <TextInput
                                    label={this.props.translate('workspace.reimburse.trackDistanceRate')}
                                    placeholder={this.state.outputCurrency}
                                    onChangeText={value => this.setRate(value)}
                                    value={this.state.unitRateValue}
                                    autoCompleteType="off"
                                    autoCorrect={false}
                                    keyboardType={CONST.KEYBOARD_TYPE.DECIMAL_PAD}
                                    onKeyPress={this.debounceUpdateOnCursorMove}
                                />
                            </View>
                            <View style={[styles.unitCol]}>
                                <Picker
                                    label={this.props.translate('workspace.reimburse.trackDistanceUnit')}
                                    items={this.unitItems}
                                    value={this.state.unitValue}
                                    onInputChange={value => this.setUnit(value)}
                                />
                            </View>
                        </View>
                    </OfflineWithFeedback>
                </Section>
                {this.props.hasVBA ? (
                    <Section
                        title={this.props.translate('workspace.reimburse.fastReimbursementsHappyMembers')}
                        icon={Illustrations.BankUserGreen}
                        menuItems={[
                            {
                                title: this.props.translate('workspace.reimburse.reimburseReceipts'),
                                onPress: () => Link.openOldDotLink(`reports?policyID=${this.props.policy.id}&from=all&type=expense&showStates=Archived&isAdvancedFilterMode=true`),
                                icon: Expensicons.Bank,
                                shouldShowRightIcon: true,
                                iconRight: Expensicons.NewWindow,
                            },
                        ]}
                    >
                        <View style={[styles.mv4]}>
                            <Text>{this.props.translate('workspace.reimburse.fastReimbursementsVBACopy')}</Text>
                        </View>
                    </Section>
                ) : (
                    <Section
                        title={this.props.translate('workspace.reimburse.unlockNextDayReimbursements')}
                        icon={Illustrations.JewelBoxGreen}
                    >
                        <View style={[styles.mv4]}>
                            <Text>{this.props.translate('workspace.reimburse.unlockNoVBACopy')}</Text>
                        </View>
                        <Button
                            text={this.props.translate('workspace.common.bankAccount')}
                            onPress={() => ReimbursementAccount.navigateToBankAccountRoute(this.props.policy.id)}
                            icon={Expensicons.Bank}
                            style={[styles.mt4]}
                            iconStyles={[styles.buttonCTAIcon]}
                            shouldShowRightIcon
                            large
                            success
                        />
                    </Section>
                )}
            </>
        );
    }
}

WorkspaceReimburseView.propTypes = propTypes;
WorkspaceReimburseView.displayName = 'WorkspaceReimburseView';

export default compose(
    withLocalize,
    withOnyx({
        policy: {
            key: ({policyID}) => `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
        },
    }),
)(WorkspaceReimburseView);
